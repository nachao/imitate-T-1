
/*

需要的数据包括：
	
	记录数据：
		交易历史数据，
		日期变化数据，

	动态数据：
		总金额值，
		总收亏值，
		当前价格值，

	动态数据集：
		价格变动值，
		购买数量值

	独立数据集
		委托控件数据值，
		卖出控件数据值，


方法分类：

	委托类，
	交易类，
	统计类，
	日期类，
	记录类，


*/

new Vue({
	el: 'body',
	data: {
		startup: 1000,

		usable: 1000,
		income: 0,
		days: 1,

		market: {
			'code'	: '002469',
			'name'	: 'Chowns',
			'price'	: 8.58,
			'hold'	: 0
		},

		became: [],				// 每日金额变得
		business: [],			// 买入/卖出交易记录

		spend: 1,				// 过去天数

		price: 0,				// 单股的金额变动
		previous: 0,			// 单股的上次金额

		number: 1,				// 买入数量

		sold: null,
		offtake: 1,				// 卖出数量

		yield: '0%',			// 收益率
		trends: true,			// 趋势
		// harden: false,		// 涨停
		// limit: false,		// 跌停

		intercalate: false,

		imitate: 0,				// 模拟次数

		annualearnings: [],
		yields: [],

		entrust: null,			// 委托操作数据
		entrustPrice: 0,		// 委托价
		entrustNumber: 0,		// 委托数量
		entrustList: [],		// 委托列表

		myChart: null,

	},
	computed: {

		// 总金额
		total: function () {
			var result = this.usable,
				self = this;

			this.business.map(function( item ){
				if ( item.have ) {
					result += item.price * item.number;
				}
			});
			this.entrustList.map(function( item ){
				if ( item.status ) {
					result += item.sold.price * (item.offtake * 100);
				}
			});

			return result.toFixed(2); 
		},

		// 持仓数量
		existOwned: function () {
			return this.business.filter(function( item ){
				return item.have;
			}).length;
		},

		// 委托数量
		entrustOwned: function () {
			return this.entrustList.filter(function( item ){
				return item.status;
			}).length;
		},

		// 交易历史
		existHistory: function () {
			return this.business.filter(function( item ){
				return !item.have;
			}).length;
		},

		// 持仓上限
		toplimit: function () {
			return parseInt(this.usable / (this.market.price * 100));
		},

		// 计算收益率统计
		monthYield: function () {
			var self = this,
				arr = this.business.filter(function( item ){ return !item.have && item.type == 'S' }),
				length = parseInt(arr.length / 22);

			var standard = 0,
				temp = 0,
				sum;

			var	result = {
					dayIncomeRatio: '100%',		// 全部天数总盈利占比
					dayRateOfReturn: '100%',	// 全部天数总收益率
					month: [],
					year: [],
					standardizedrate: ''
				};

			// 年
			for ( var i=0; i<parseInt(arr.length / (22 * 12)); i++ ) {
				temp = 0;
				arr.slice(i*(22*12), i*(22*12)+(22*12)).map(function( item ){
					temp += (item.sell - item.price) / item.price * 100;
				});
				result.year.push((temp/22).toFixed(2) + '%');
			}

			// 月
			for ( var i=0; i<length; i++ ) {
				sum = 0;
				temp=0;
				arr.slice(i*22, i*22+22).map(function( item ){
					sum += (item.sell - item.price ) * item.number;
					temp += (item.sell - item.price) / item.price * 100;
				});
				if ( temp > 22 ) {
					standard += 1;
				}
				result.month.push({
					ratio: (temp/22).toFixed(2) + '%',
					value: parseInt(sum)
				});
			}

			// 日
			var incomeTotal = 0;
			var incomeDays = arr.filter(function( item ){
					incomeTotal += self.getIncomeYield( item.price, item.sell, item.number/100 );
					return item.sell > item.price;
				}).length;

			console.log(incomeTotal);

			if ( this.business.length ) {
				result.dayRateOfReturn = (incomeTotal / this.days).toFixed(2) + '%';
			}
			if ( arr.length ) {
				result.dayIncomeRatio = (incomeDays / arr.length * 100).toFixed(2) + '%';
			}

			// 月标准率
			if ( standard ) {
				result.standardizedrate = (standard / result.month.length * 100).toFixed(2) + '%';
			}

			return result;
		},

		// 盈利和亏损总金额
		totalProfitAndLoss: function () {
			var self = this,
				value = 0,
				result = {
					profit: 0,
					loss: 0
				};

			this.business.map(function( item ){
				if ( item.type == 'S' ) {
					value = self.getIncome( item.price, item.sell, item.number/100 );
					if ( value > 0 ) {
						result.profit += value;
					}
					else {
						result.loss += value;
					}
				}
			});

			return result;
		}

	},
	watch: {

		// 监听价格变动
		market: {
			handler: function () {
				var self = this;

				// 处理委托
				this.entrustList.map(function( item ){
					if ( item.status && item.sold.days < self.days && item.price <= self.market.price ) {
						self.sold = item.sold;
						self.offtake = item.offtake;
						self.setSoldEntrust(item);

						item.status = false;
					}
				});
			},
			deep: true

		},

		// 计算日收益率
		previous: function () {
			var self = this;
				yesterday = 0;

			this.became.map(function( item ){
				if ( item.days + 1 == self.days && yesterday == 0 ) {
					yesterday = item.price;
				}
			});

			this.yield = (( this.price - yesterday ) / this.price * 100).toFixed(2) + '%';
			this.trends = Number(this.price) > Number(yesterday);
			// this.harden = Number(this.price) > Number(this.previous);
			// this.limit = Number(this.price) < Number(this.previous);
		},

		// 监听盈利
		income: function () {

			// 更新当天的总金额
			this.became[0].income = this.income;

			// 统计资产
			this.updateCartogram();
		}
	},
	methods: {

		// 买入
		setBuy: function () {
			var number = (parseInt(this.number) || 0 ) * 100,
				money = number * this.market.price;

			if ( this.usable >= money && money ) {
				this.usable = Number((this.usable - money).toFixed(2));
				this.market.hold += number;
				this.setBuyLog(number);

				this.number = 1;
			}
		},

		// 卖出
		setSold: function () {
			var b = this.sold.price,
				s = this.market.price,
				n = this.offtake;

			var number = n * 100;

			this.income = Number((this.income + this.getIncome(b,s,n)).toFixed(2));
			this.usable = Number((this.usable + this.getIncome(b,s,n,true)).toFixed(2));

			// 如果平仓 
			if ( this.sold.number == number ) {
				this.sold.have = false;
			}

			// 减仓
			this.market.hold -= number;
			this.sold.number -= number;

			// 记录
			this.setSoldLog(b, s, n*100);

			// 初始化
			this.sold = null;
			this.offtake = 0;
		},

		// 卖出委托
		setSoldEntrust: function ( item ) {
			var b = item.sold.price,
				s = item.price,
				n = item.offtake;

			this.income = Number((this.income + this.getIncome(b,s,n)).toFixed(2));
			this.usable = Number((this.usable + this.getIncome(b,s,n,true)).toFixed(2));

			// 如果平仓 
			if ( item.sold.number == 0 ) {
				item.sold.have = false;
			}

			// 记录
			this.setSoldLog(b, s, n*100);
		},

		// 添加购买交易记录
		setBuyLog: function ( number ) {
			var isOpen = true,
				self = this;

			this.business.map(function( item ){
				if ( item.price == self.market.price && item.days == self.days && item.type == 'B' ) {
					item.number += number;
					isOpen = false;
				}
			});

			// 是否开仓
			if ( isOpen ) {
				this.business.push({
					'type'	: 'B',
					'key'	: new Date().getTime().toString(16),
					'have'	: true,
					'number': number,
					'price'	: this.market.price,
					'sell'	: 0,
					'days'	: this.days
				});
			}
		},

		// 添加卖出记录
		setSoldLog: function ( buyPrice, soldPrice, soldNumber ) {
			var isNew = true,
				self = this;

			this.business.map(function( item ){
				if ( item.days == self.days && item.type == 'S' ) {
					item.number += soldNumber;
					isNew = false;
				}
			});

			if ( isNew ) {
				this.business.push({
					'type'	: 'S',
					'key'	: new Date().getTime().toString(16),
					'have'	: false,
					'number': soldNumber,
					'price'	: buyPrice,
					'sell'	: soldPrice,
					'days'	: this.days
				});
			}
		},

		// 收盘定价
		setToday: function () {
			var self = this,
				price = Number(this.price);

			this.previous = this.market.price;

			this.days += this.spend;
			this.market.price = price;

			var isAdd = true;

			this.became.map(function( item ){
				if ( item.days == self.days ) {
					item.price = price;
					isAdd = false;
				}
			});

			if ( isAdd ) {
				this.became.unshift({
					'days'	: this.days,
					'price'	: this.market.price,
					'total'	: this.total,
					'income': this.income
				});
			}

			// 统计资产
			this.updateCartogram();
		},

		// 获取当前持有的收益率（不计手续费）
		getYield : function ( item ) {
			return ((this.market.price - item.price) * item.price).toFixed(2) + '%';
		},

		//获取当前持有的收益（不计手续费）
		getProfit: function ( item ) {
			return parseInt((this.market.price - item.price) * item.number);
		},

		// 获取单笔交易的收益率（不计手续费）
		getSingleYield : function ( item, sell ) {
			return ((item.sell - item.price) * item.price).toFixed(2) + '%';
		},

		// 获取单笔交易的收益（不计手续费）
		getSingleProfit: function ( item ) {
			return parseInt((item.sell - item.price) * item.number);
		},

		// 获取单笔委托的收益率（不计手续费）
		getEntrustYield: function ( item ) {
			return ((item.price - item.sold.price) / item.sold.price * 100).toFixed(2) + '%';
		},

		// 获取单笔委托的收益（不计手续费）
		getEntrustProfit: function ( item ) {
			return ((item.price - item.sold.price) * item.offtake * 100).toFixed(2);
		},

		// 获取单笔净收益率（过滤手续费）
		getCleanYield: function ( item ) {
			return this.getIncome(item.price, item.sell, item.number/100);
		},

		// 获取单笔净收益（过滤手续费）
		getCleanProfit: function ( item ) {
			return this.getIncomeYield(item.price, item.sell, item.number/100);
		},

		// 加庄 减庄
		setAddPrice: function () {
			this.price = (Number(this.price) + 0.01).toFixed(2);
		},
		setSubPrice: function () {
			this.price = (Number(this.price) - 0.01).toFixed(2);
		},

		// 加仓 减仓
		setAddHold: function () {
			this.number = Number(this.number) + 1 > parseInt(this.usable / (this.market.price * 100)) ? Number(this.number) : Number(this.number) + 1;
		},
		setSubHold: function () {
			this.number = Number(this.number) - 1 < 0 ? 0 : Number(this.number) - 1;
		},

		// 加减 卖出 
		setAddOfftake: function () {
			this.offtake = Number(this.offtake) + 1 > this.sold.number / 100 ? this.offtake : Number(this.offtake) + 1;
		},
		setSubOfftake: function () {
			this.offtake = Number(this.offtake) - 1 < 0 ? 0 : Number(this.offtake) - 1;
		},

		// 加减 托管价 
		setAddEntrustPrice: function () {
			this.entrustPrice = (Number(this.entrustPrice) + 0.01).toFixed(2);
		},
		setSubEntrustPrice: function () {
			this.entrustPrice = (Number(this.entrustPrice) - 0.01).toFixed(2);
		},

		// 加减 托管数量
		setAddEntrustNumber: function () {
			this.entrustNumber = Number(this.entrustNumber) + 1 > this.entrust.number / 100 ? this.entrustNumber : Number(this.entrustNumber) + 1;
		},
		setSubEntrustNumber: function () {
			this.entrustNumber = Number(this.entrustNumber) - 1 < 0 ? 0 : Number(this.entrustNumber) - 1;
		},


		// 持续
		setLastStart: function ( key ) {
			var self = this;

			clearTimeout(window.t);
			window.t = setTimeout(function(){
				self.setLastStart(key);
				if ( self[key] ) {
					self[key]();
				}
			}, window.t ? 150 : 500);
		},
		setLastEnd: function () {
			clearTimeout(window.t);
		},

		// 获取净收益总额（去除手续费）
		getIncome: function ( b, s, n, t ) {
			if ( n === true ) {
				t = n; n = 1
			};
			return Number(((( s - b ) * 100 * n ) - ( s * 100 * n * 0.001 ) - (Math.max(b * 0.002, 5)) - (Math.max(b * 0.002, 5))).toFixed(2)) + ( t ? ( b * 100 * n ) : 0 );
		},

		// 获取净收益率（去除手续费）
		getIncomeYield: function ( b, s, n, t ) {
			if ( n === true ) {
				t = n; n = 1
			};
			var income = Number(((( s - b ) * 100 * n ) - ( s * 100 * n * 0.001 ) - (Math.max(b * 0.002, 5)) - (Math.max(b * 0.002, 5))).toFixed(2)) + ( t ? ( b * 100 * n ) : 0 );

			return Number((income / (b*n*100) * 100).toFixed(2));
		},

		// 获取两位小数
		getFixed: function ( value ) {
			return Number(value || 0).toFixed(2);
		},

		// 取整数
		getInt: function ( value ) {
			return parseInt(value) || 0;
		},

		// 模拟交易
		setImitate: function () {
			var change = parseInt(Math.random()*100)+1 <= 70,			// 几率
				random = Number(Number( (Math.random()*10).toFixed(2) / 100 )).toFixed(2);

			random = 0.001 + (parseInt((Math.random()*24)) / 1000);

			var value = Number(this.price * random) || 0;

			// 价格
			if ( change ) {
				this.price = (Number(this.price) + value).toFixed(2);
			}
			else {
				this.price = (Number(this.price) - value).toFixed(2);
			}
			this.setToday();

			// 卖出
			if ( this.existOwned ) {
				for ( var i=0, item; item = this.business[i]; i++ ) {
					if ( item.have ) {
						this.offtake = item.number / 100;
						this.sold = item;
						break;
					}
				}
				if ( this.sold ) {
					this.setSold();
				}
			}

			// 存入
			if ( this.business % 22 == 0 ) {
				this.usable += 1000;
			}

			if ( this.imitate < 5 ) {	// 22 * 12

				// 买入
				this.number = this.toplimit;
				this.setBuy();

				this.imitate += 1;
				setTimeout(this.setImitate, 1000);
			}
			else {
				// var self = this;
				// window.annualearnings = this.annualearnings.push(this.usable + this.income);
				// setTimeout(function(){
				// 	self.usable = 10000;
				// 	self.income = 0;
				// 	self.price = 8.58;
				// 	self.business = [];
				// 	self.became = [];
				// 	self.spend = 1;
				// 	self.number = 1;
				// 	self.offtake = 1;
				// 	self.days = 1;
				// 	self.imitate = 0
				// 	self.setImitate();
				// }, 3000);
			}
		},

		// 打开卖出界面
		getSold: function ( item ) {
			this.entrust = null;

			if ( this.sold == null ) {
				this.sold = item;
				this.offtake = item.number /100;
			}
			else {
				this.sold = null;	
			}
		},

		// 打开委托界面
		getEntrust: function ( item ) {
			this.sold = null;

			if ( this.entrust == null ) {
				this.entrust = item;
				this.entrustPrice = this.getSuggestedPrice(item);
				this.entrustNumber = item.number /100;
			}
			else {
				this.entrust = null;
			}
		},

		// 获取建议价
		getSuggestedPrice: function ( item ) {
			return (item.price + item.price * 0.014).toFixed(2);
		},

		// 获取建议差价点数
		getSuggestedPoints: function ( item ) {
			return parseInt(item.price * 0.014 * 100);
		},

		// 设置建议差价点数
		setSuggestedPoints: function ( item, value ) {
			var result = this.getSuggestedPoints(item) * ( value || 1 ) / 100;
			this.entrustPrice = (Number(item.price) + result).toFixed(2);
		},

		// 设置委托
		setEntrust: function () {
			var self = this;
			var exitsEntrust = true;

			this.entrustList.map(function( item ){
				if ( item.price == self.entrustPrice ) {
					item.offtake += parseInt(self.entrustNumber);
					item.status = true;
					exitsEntrust = false;
				}
			});

			if ( exitsEntrust ) {
				this.entrustList.push({
					price: this.entrustPrice,
					offtake: this.entrustNumber,
					sold: this.entrust,
					status: true
				});
			}

			this.entrust.number -= this.entrustNumber * 100;
			this.entrust = null;
		},

		// 取消委托
		setCancelEntrust: function ( item ) {
			item.sold.number += item.offtake * 100;
			item.sold.have = true;
			item.offtake = 0;
			item.status = false;
		},

		// 显示统计图
		setCartogram: function () {
			var self = this;

			// 基于准备好的dom，初始化echarts实例
			this.myChart = echarts.init(document.getElementById('echartsEl'));

			$(window).resize(function(){
				clearTimeout(window.c);
				window.c=setTimeout(function(){
					self.setCartogram();
					self.updateCartogram();
				}, 500);
			});

			// 指定图表的配置项和数据
			var option = {
					title: {
						text: ''
					},
					tooltip: {},
					legend: {
						show: false,
						data: ['Total']
					},
					xAxis: {
						data: []
					},
					yAxis: {},
					series: [{
						name: 'Total',
						type: 'line',
						data: []
					}]
				};

			// 使用刚指定的配置项和数据显示图表。
			this.myChart.setOption(option);
		},

		// 更新资产统计图
		updateCartogram: function () {
			var keys = [1],
				values = [0],
				data = Object.assign([], this.became).reverse();

			var self = this;

			data.map(function( item ){
				keys.push(item.days);
				values.push(item.income);
			});

			this.myChart.setOption({
				xAxis: {
					data: keys
				},
				series: [{
					name: 'Total',
					data: values
				}]
			});
		}
	},
	ready: function () {
		this.price = this.market.price;
		this.previous = this.market.price;

		this.setCartogram();
		this.updateCartogram();
		// this.setImitate();
	}
});




// 获取收益
// var income = function ( b=1, s=10, n=1, t=false ) {
// 		if ( n === true ) {
// 			t = n; n = 1
// 		};
// 		return Number(((( s - b ) * 100 * n ) - ( s * 100 * n * 0.001 ) - (Math.max(b * 0.002, 5)) - (Math.max(b * 0.002, 5))).toFixed(2)) + ( t ? ( b * 100 * n ) : 0 );
// 	};
// var value = 10000;
// for ( var i =0; i<12; i++ ) {
// 	console.log( (i+1) + '月-----------------------');
// 	console.log( '本金：' + value, '收益：' + parseInt(value*0.3), '总金额：' + (value += parseInt(value * 0.3)) );
// }

// 日净收益为1%，每月净收益22%，计算出年净收益率：1000%。
// for(var a=10000,x=0.22,i=1;i<=12;i++){ a=a+a*x }
