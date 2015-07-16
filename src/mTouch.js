(function (global, doc, factory) {
	factory = factory(global, doc);

	//对外提供的接口
	if (typeof global.define === 'function' && (define.amd || define.cmd)) {
		define(function () {
			return factory;
		});
	} else {
		global.mTouch = global.mTouch || factory;
	}

})(window || this, document, function (global, doc) {

	var util = {
		//是否具有touch事件
		hasTouch: !!('ontouchstart' in window),
		/**
		 * 判断节点是否是事件代理的目标
		 * @param {object} el dom节点对象
		 * @param {string} proxyStr 事件委托的选择器
		 */
		isProxyTarget: function (el, proxyStr) {
			//class代理
			if (proxyStr.startsWith('.')) {
				return new RegExp('\\s|^' + proxyStr.substring(1) + '\\s|$').test(el.className);
			//id代理
			} else if (proxyStr.startsWith('#')) {
				return el.id == proxyStr.substring(1);
			//标签代理
			} else {
				return el.tagName.toLocaleLowerCase() == proxyStr;
			}
		},

		/**
		 * 获取滑动方向
		 * @param {number} x1 滑动开始的x坐标
		 * @param {number} y1 滑动开始的y坐标
		 * @param {number} x2 滑动结束的x坐标
		 * @param {number} y2 滑动结束的y坐标
		 */
		swipeDirection: function (x1, y1, x2, y2) {
			return Math.abs(x1 - x2) >= Math.abs(y1 - y2) ? (x1 > x2 ? 'LEFT' : 'RIGHT') : (y1 > y2 ? 'UP' : 'DOWN');
		}
	};

	//相关控制配置项
	var config = {
		tapMaxDistance: 10,		//单击事件允许的滑动距离
		doubleTapDelay: 200,	//双击事件的延时时长（两次单击的最大时间间隔）
		longTapDelay: 700,		//长按事件的最小时长
		swipeMinDistance: 20,	//触发方向滑动的最小距离
		swipeTime: 200			//触发方向滑动允许的最长时长
	};

	//事件类型列表
	var eventList = {
		TOUCH_START: util.hasTouch ? 'touchstart' : 'mousedown',
		TOUCH_MOVE: util.hasTouch ? 'touchmove' : 'mousemove',
		TOUCH_END: util.hasTouch ? 'touchend' : 'mouseup',
		TOUCH_CANCEL: 'touchcancel',
		TAP: 'tap',
		DOUBLE_TAP: 'doubletap',
		LONG_TAP: 'longtap',
		SWIPE_START: 'swipestart',
		SWIPING: 'swiping',
		SWIPE_END: 'swipeend',
		SWIPE_LEFT: 'swipeleft',
		SWIPE_RIGHT: 'swiperight',
		SWIPE_UP: 'swipeup',
		SWIPE_DOWN: 'swipedown'
	}

	/**
	 * touch相关主函数
	 * @param {object} el dom节点
	 */
	var Mtouch = function (el) {
		this._events = {};	//事件集合
		this.el = el;
		bindTouchEvents.call(this, el);
	};

	Mtouch.prototype = {
		/**
		 * 绑定事件函数，支持事件委托
		 * @param {string} eventType 事件类型，可同时绑定多个事件，用空格隔开
		 * @param [string] proxyStr 事件委托选择器（可选）
		 * @param {function} 事件监听回调函数
		 */
		on: function (eventType, proxyStr, handler) {
			//参数预处理
			if (!handler && typeof proxyStr == 'function') {
				handler = proxyStr;
				proxyStr = null;
			}
			if (typeof handler != 'function' || !eventType || !eventType.length) {
				return ;
			}

			var _events = this._events;

			//拆分多个事件类型
			var eventTypesArr = eventType.split(/\s+/);

			eventTypesArr.forEach(function (type, key) {
				//如果未绑定过该事件，则创建一个
				if (!_events[type]) {
					_events[type] = [];
				}

				_events[type].push({
					'handler': handler,
					'proxyStr': proxyStr
				});
			});

			return this;
		},

		/**
		 * 解绑事件
		 * @param {string} eventType 事件类型
		 * @param {string} proxyStr 事件委托选择器
		 */
		off: function (eventType, proxyStr) {
			var _events = this._events;

			if (_events.hasOwnProperty(eventType)) {
				var handlerList = _events[eventType];
				//只需解绑代理的事件
				if (typeof proxyStr == 'string') {
					var len = handlerList.length - 1;
					//遍历事件数组，删除相应代理事件
					while (len >= 0) {
						if (handlerList[len].proxyStr == proxyStr) {
							handlerList.splice(len, 1);
						}
						len--;
					}
				//解绑该类型所有事件
				} else {
					//清空事件数组的事件
					_events[eventType] = [];
				}
			}

			return this;
		},

		/**
		 * 触发事件，支持事件委托冒泡处理
		 * @param {string} eventType 事件类型
		 * @param {object} event 原生事件对象
		 */
		trigger: function (eventType, event) {
			if (!this._events.hasOwnProperty(eventType)) {
				return ;

			}

			var handlerList = this._events[eventType],	//事件回调数组
				target = event.target;

			//开始冒泡循环
			while (1) {
				var i, len, handler, proxyStr;

				//已冒泡至顶，检测是否需要执行回调
				if (target === this.el || !target) {

					for (i = 0, len = handlerList.length; i < len; i++) {
						handler = handlerList[i].handler,
						proxyStr = handlerList[i].proxyStr;
						//如果没有事件委托或者委托的是自身则执行回调
						if (proxyStr === null || util.isProxyTarget(target, proxyStr)) {
							//如果回调执行后返回false，则跳出后续事件
							if (this._callback(eventType, handler, target, event) === false) {
								break;
							}
						}
					}

					return ;	//已冒泡至顶，无需再冒泡
				}

				//存放临时回调数组
				var tempHandlerList = handlerList;
				//清空事件回调数组
				handlerList = [];
				//开始遍历回调数组，判断是否是委托目标来决定是否执行回调
				for (i = 0, len = tempHandlerList.length; i < len; i++) {
					handler = tempHandlerList[i].handler,
					proxyStr = tempHandlerList[i].proxyStr;

					//如果是委托目标，则执行回调
					if (proxyStr && util.isProxyTarget(target, proxyStr)) {
						//如果回调执行后返回false，则跳出冒泡及后续事件
						if (this._callback(eventType, handler, target, event) === false) {
							return ;
						};
					} else {
						//不是委托目标，则将回调对象继续压回事件回调数组，继续冒泡
						handlerList.push(tempHandlerList[i]);
					}
				}

				//向上冒泡
				target = target.parentNode;
			}			
		},

		/**
		 * 事件回调的处理函数
		 * @param {string} eventType 事件类型
		 * @param {function} handler 回调函数
		 * @param {object} el 目标dom节点
		 * @param {object} event 原生事件对象
		 */
		_callback: function (eventType, handler, el, event) {
			var	touch = util.hasTouch ? (event.touches.length ? event.touches[0] : event.changedTouches[0]) : event;

			//构建新的事件对象
			var mTouchEvent = {
				'type': eventType,
				'target': event.target,
				'pageX': touch.pageX || 0,
				'pageY': touch.pageY || 0
			};

			//如果是滑动事件则添加初始位置及滑动距离
			if (/^swipe/.test(eventType) && event.startPosition) {
				mTouchEvent.startX = event.startPosition.pageX;
				mTouchEvent.startY = event.startPosition.pageY;
				mTouchEvent.moveX = mTouchEvent.pageX - mTouchEvent.startX;
				mTouchEvent.moveY = mTouchEvent.pageY - mTouchEvent.startY;
			}

			//将新的事件对象拓展到原生事件对象里
			event.mTouchEvent = mTouchEvent;

			var result = handler.call(el, event);
			//如果回调执行后返回false，则阻止默认行为和阻止冒泡
			if (result === false) {
				event.preventDefault();
				event.stopPropagation();
			}

			return result;
		}
	};

	/**
	 * 绑定原生touch事件
	 * @param {object} el 对应的dom节点
	 */
	function bindTouchEvents(el) {
		var touchInstance = this;
		//触屏开始时间
		var touchStartTime = 0;

		//最后一次触屏时间
		var lastTouchTime = 0;

		//坐标位置
		var	x1, x2, x3, x4;

		//单击、长按定时器
		var tapTimer, longTapTimer;

		//记录是否触屏开始
		var isTouchStart = false;

		//是否已经触发了方向滑动事件
		var isSwiped = false;

		//重置所有定时器
		var resetTimer = function () {
			clearTimeout(tapTimer);
			clearTimeout(longTapTimer);
		};

		//触发单击事件
		var triggerSingleTap = function (event) {
			isTouchStart = false;
			resetTimer();
			touchInstance.trigger(eventList.TAP, event);
		};

		//开始触屏监听函数
		var touchstart = function (event) {
			var touch = util.hasTouch ? event.touches[0] : event;

			x1 = touch.pageX;
			y1 = touch.pageY;
			x2 = 0;
			y2 = 0;

			isTouchStart = true;
			isSwiped = false;
			touchStartTime = +new Date();

			//触发滑动开始事件
			touchInstance.trigger(eventList.SWIPE_START, event);

			clearTimeout(longTapTimer);
			//设置长按事件定时器
			longTapTimer = setTimeout(function () {
				isTouchStart = false;
				//清楚定时器
				resetTimer();
				touchInstance.trigger(eventList.LONG_TAP, event);
			}, config.longTapDelay);
		};

		//手指滑动监听函数
		var touchmove = function (event) {
			if (!isTouchStart) {
				return ;
			}

			var touch = util.hasTouch ? event.touches[0] : event,
				now   = +new Date();

			//记录滑动初始值，为swipe事件传递更多值
			event.startPosition = {
				'pageX': x1,
				'pageY': y1 
			};

			//触发滑动中事件
			touchInstance.trigger(eventList.SWIPING, event);

			x2 = touch.pageX;
			y2 = touch.pageY;

			var distanceX = Math.abs(x1 - x2),
				distanceY = Math.abs(y1 - y2);

			//如果滑动距离超过了单击允许的距离范围，则取消延时事件
			if (distanceX > config.tapMaxDistance || distanceY > config.tapMaxDistance) {
				resetTimer();
			}

			//如果滑动时长在允许的范围内，且滑动距离超过了最小控制阀值，触发方向滑动事件
			if (!isSwiped
				&& now - touchStartTime <= config.swipeTime
				&& ( distanceX > config.swipeMinDistance  || distanceY > config.swipeMinDistance)
			) {
				//滑动方向LEFT, RIGHT, UP, DOWN
				var direction = util.swipeDirection(x1, y1, x2, y2);

				resetTimer();
				isSwiped = true;

				touchInstance.trigger(eventList['SWIPE_' + direction], event);
			}			
		};

		//触屏结束函数
		var touchend = function (event) {
			if (!isTouchStart) {
				return ;
			}

			var touch = util.hasTouch ? event.changedTouches[0] : event;	

			x2 = touch.pageX;
			y2 = touch.pageY;

			var now = +new Date();

			//触发滑动结束事件
			touchInstance.trigger(eventList.SWIPE_END, event);

			//如果开始跟结束坐标距离在允许范围内则触发单击事件
			if (Math.abs(x1 - x2) <= config.tapMaxDistance && Math.abs(y1 - y2) <= config.tapMaxDistance) {
				//如果没有绑定双击事件，则立即出发单击事件
				if (!touchInstance._events[eventList.DOUBLE_TAP] || !touchInstance._events[eventList.DOUBLE_TAP].length ) {
					triggerSingleTap(event);

				//如果距离上一次触屏的时长大于双击延时时长，延迟触发单击事件
				} else if (now - lastTouchTime > config.doubleTapDelay){
					tapTimer = setTimeout(function () {
						triggerSingleTap(event);
					}, config.doubleTapDelay);

				//如果距离上一次触屏的时长在双击延时时长内
				//则清除单击事件计时器，并触发双击事件
				} else {
					resetTimer();
					touchInstance.trigger(eventList.DOUBLE_TAP, event);
				}

				lastTouchTime = now;
			}

			isTouchStart = false;
		};

		//绑定触屏开始事件
		el.addEventListener(eventList.TOUCH_START, touchstart);
		//绑定触屏滑动事件
		el.addEventListener(eventList.TOUCH_MOVE, touchmove);
		//绑定触屏结束事件
		el.addEventListener(eventList.TOUCH_END, touchend);
		//绑定触屏取消事件
		el.addEventListener(eventList.TOUCH_CANCEL, resetTimer);
	}


	/** 
	 * 返回的辅助函数
	 * @param {string} selector 选择器字符串
	 */
	var mTouch = function (selector) {
		var elems = doc.querySelectorAll(selector);

		if (!elems.length) { return ;}

		var touchArr = [], i = 0, len = elems.length;

		for (; i < len; i++) {
			touchArr.push(new Mtouch(elems[i]));
		}

		return touchArr.length > 1 ? touchArr : touchArr[0];
	};
	//配置touch事件相关控制的接口
	mTouch.config = function (cfg) {
		for (var k in cfg) {
			if (cfg.hasOwnProperty(k)) {
				config[k] = cfg[k];
			}
		}
	};

	return mTouch;
});