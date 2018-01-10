/* @todo:
 * [+] data-bind="opt" - привязка к объекту
 * [+] data-on="click:close" - привязка к событию
 */

;( function( factory )
{
	// AMD
	if( typeof define === 'function' && define.amd ) { define( [ 'jquery' ], factory ); } 
	// CommonJS
	else if( typeof exports === 'object' ) { module.exports = factory( window.Zepto || window.jQuery || window.$ || require( 'jquery' ), window, document ); } 
	// 
	else { factory( window.Zepto || window.jQuery || window.$, window, document ); }
}

( function( $, window, document )
{
	'use strict';
	
	//
	const pluginName = 'myData';
	const isJQ = !!( window.jQuery );

	// Плагин
	let Plugin = function( element, targetObject, callback )
	{
		//
		this.bindings = [ ];
		this.checkTimer = undefined;

		// Запоминаем
		this.element = $( element );
		this.targetObject = targetObject;
		this.callbacks = { };

		// Callback`s
		if( typeof callback === 'function' )
		{
			this.callbacks.main = callback;
		}
		else if( typeof callback === 'object' )
		{
			this.callbacks.main = callback.main;
			this.callbacks.get = callback.get;
			this.callbacks.set = callback.set;
			this.callbacks.on = callback.on;
		}

		// Инициаплизация
		this.bind( );
	};

	Plugin.prototype =
	{
		// Навешивание событий и обработчиков
		bind: function( )
		{
			const context = this;
			
			// Формируем список проверяемых параметров
			// @todo: Будет не верно работать в случае с динамически изменяемым содержимим элемента 
			//		(так как считывание происходит только один раз)
			this.element.find( '[data-bind]' ).each( function( index, item )
			{
				let element = $( item ),
					propName = element.attr( 'data-bind' ) || '';
				
				if( propName === '' ) { return; }

				// Записываем элемент
				context.bindings.push( { element: item, property: propName, value: undefined } );
			} );
			
			this._setEventListeners( );
			this._setCheckTimer( );
		},
		
		// Снятие событий и обработчиков
		unbind: function( )
		{
			// Отключение проверки событий
			this.element.off( '.' + pluginName, '[data-bind]' );
			this.element.off( '.' + pluginName, '[data-on]' );
						
			// Таймер проверки значений
			clearInterval( this.checkTimer );
			
			//
			this.bindings = [ ];
		},
		
		// Реакция на изменение состояния элемента
		_setEventListeners: function( )
		{
			const context = this;
			const bindEvents = [ 'change', 'keydown', 'input', 'paste' ].map( function( item ) { return item += '.' + pluginName; } );
			const onEvents = [ 'click', 'dblclick', 'change', 'input', 'paste', 'load', 'unload', 'select', 
								'resize', 'scroll', 'submit', 'error', 'keydown', 'keyup', 'keypress', 
								'mouseover', 'mousedown', 'mouseup', 'mousemove', 'mouseout', 'mouseenter', 'mouseleave',
								 'blur', 'focus', 'focusin', 'focusout' ].map( function( item ) { return item += '.' + pluginName; } );

			// Реакция на смену состояния элемента
			// data-bind="key" 
			this.element.on( bindEvents.join( ' ' ), '[data-bind]', function( event )
			{
				let element = $( event.target );
				let	targetKey = element.attr( 'data-bind' );
				let	value = undefined;

				// Заменяем значение в список
				for( let i in context.bindings )
				{
					let item = context.bindings[ i ];
					
					if( item.element !== event.target || item.property !== targetKey ) { continue; }

					// Считываем значение
					value = context._readElementValue( element, item.value );

					// Имя функции для установки значения
					let setFunctionName = 'set' + targetKey.charAt( 0 ).toUpperCase( ) + targetKey.substr( 1 );

					// Если значение изменилось с прошлого раза
					if( value !== item.value )
					{
						item.value = value;
						
						// Установка значения
						if( typeof context.targetObject[ setFunctionName ] === 'function' ) { context.targetObject[ setFunctionName ].apply( context.targetObject, [ value ] );	}
						else if( typeof context.targetObject[ targetKey ] === 'function' ) { context.targetObject[ targetKey ].apply( context.targetObject, [ value ] ); }
						else if( context.targetObject.hasOwnProperty( targetKey ) ) { context.targetObject[ targetKey ] = value; }
						
						break;
					}
				}
				
				//
				if( typeof context.callbacks.set === 'function' ) {	context.callbacks.set( element, targetKey, value );	}
				else if( typeof context.callbacks.main === 'function' )	{ context.callbacks.main( 'set', element, targetKey, value ); }
			} );
			
			// Обработка установленных событий
			// data-on="click,change:close" 
			this.element.on( onEvents.join( ' ' ), '[data-on]', function( event )
			{
				const element = $( event.target );
				let	actionData = element.attr( 'data-on' );
				let	value = undefined;
					
				let onData = actionData.split( ':' );
				let	eventTypes = onData[ 0 ].split( ',' );
				let	action = onData[ 1 ];
				let	actionFunc = /([a-zA-Z0-9,\.\-_\/]+)(?:\(([^)]+)\))?$/.exec( action ) || false;
					
				// Если данной событие не указано в перечне - игнорируем
				if( eventTypes.indexOf( event.type ) < 0 ) { return ; }
	
				// Вызов функции
				if( actionFunc ) 
				{
					const name = actionFunc[ 1 ];
					const args = ( typeof actionFunc[ 2 ] !== 'string' ) ? [ ] : actionFunc[ 2 ].split( ',' ).map( function( item ) { return item.trim( ); } );
						
					//
					if( typeof context.targetObject[ name ] === 'function' )
					{
						// Считываем значение элемента
						value = context._readElementValue( element, undefined );
						
						// Вызываем функцию
						context.targetObject[ name ].apply( context.targetObject, args.concat( [ value ] ) );
						
						//
						if( typeof context.callbacks.on === 'function' ) {	context.callbacks.on( element, event.type, value );	}
						else if( typeof context.callbacks.main === 'function' )	{ context.callbacks.main( 'on', element, event.type, value ); }
					}
				}
			} );
		},
		
		// Таймер прослушивания изменений объекта
		_setCheckTimer: function( delay = 250 )
		{
			let context = this;
			
			// Таймер проверки значений
			this.checkTimer = setInterval( function( )
			{
				for( let i in context.bindings )
				{
					// Изменяемая ссылка на текущий элемент
					let item = context.bindings[ i ];
					let	element = $( item.element );
					let	targetKey = item.property;
					let	oldValue = item.value;
					let	value = '';

					// Имя функции для установки значения
					let getFunctionName = 'get' + targetKey.charAt( 0 ).toUpperCase( ) + targetKey.substr( 1 );

					// Проверка функции "get"
					if( typeof context.targetObject[ getFunctionName ] === 'function' )	{ value = context.targetObject[ getFunctionName ]( ); }
					else if( typeof context.targetObject[ targetKey ] === 'function' ) { value = context.targetObject[ targetKey ]( ); }
					else if( context.targetObject.hasOwnProperty( targetKey ) )	{ value = context.targetObject[ targetKey ]; }
					
					// Меняем значение элемента
					if( value !== oldValue )
					{
						item.value = value;
						
						//
						if( element.is( 'input[type="checkbox"]' ) || element.is( 'input[type="radio"]' ) ) { $( element ).attr( 'checked', value ); }
						else if( element.is( 'select' ) || element.is( 'input' ) || element.is( 'textarea' ) ) { $( element ).val( value ); }
						else { $( element ).html( value ); }

						//
						if( typeof context.callbacks.get === 'function' ) {	context.callbacks.get( element, targetKey, value );	}
						else if( typeof context.callbacks.main === 'function' )	{ context.callbacks.main( 'get', element, targetKey, value ); }
					}
				}
			}, delay );
		},
		
		// Считывание значения
		_readElementValue: function( element, oldValue )
		{
			let value = undefined;
			
			// input:checkbox
			if( element.is( 'input[type="checkbox"]' ) || element.is( 'input[type="radio"]' ) )
			{
				if( typeof oldValue === 'boolean' || $( element ).attr( 'value' ) === undefined ) { value = $( element ).is( ':checked' ); }
				else { value = $( element ).val( ); }
			}
			// select
			else if( element.is( 'select' ) ) 
			{ 
				if( typeof oldValue === 'number' ) { value = $( element ).find( ':selected' ).index( );  }
				else { value = $( element ).val( ); }
			}
			// input
			else if( element.is( 'input' ) || element.is( 'textarea' ) ) { value = $( element ).val( ); }
			// Такое возможно при "contenteditable" элементе или при использовании "data-on"
			else { value = $( element ).attr( 'value' ) || $( element ).html( ); };
			
			return value;
		},
		
		// Уничтожение плагина
		destroy: function( )
		{
			this.unbind( );
			
			if( isJQ ) { this.element.removeData( '_' + pluginName ); }
			else { delete this.element[ 0 ][ '_' + pluginName ]; }
		}
	};

	// Прописываем плагин
	$.fn[ pluginName ] = function( params, callback )
	{
		const args = arguments;
		
		// Если параметры это объект
		if( params === undefined || typeof params === 'object' )
		{
			// Проходим по компонентам
			this.each( function( )
			{
				const instance = isJQ ? $( this ).data( '_' + pluginName ) : $( this )[ 0 ][ '_' + pluginName ];
				
				if( !instance )
				{
					let plugin = new Plugin( this, params, callback );
					
					if( isJQ ) { $( this ).data( '_' + pluginName, plugin ); }
					else { $( this )[ 0 ][ '_' + pluginName ] = plugin;	}
				}
			} );
					
			return this;
		}
		// Если параметры это строка
		else if( typeof params === 'string' && params[0] !== '_' && params !== 'init' )
		{
			let returns = undefined;
			
			//
			this.each( function( )
			{
				const instance = isJQ ? $( this ).data( '_' + pluginName ) : $( this )[ 0 ][ '_' + pluginName ];
				
				if( instance instanceof Plugin && typeof instance[ params ] === 'function' )
				{
					returns = instance[ params ].apply( instance, Array.prototype.slice.call( args, 1 ) );
				}
			} );
			
			return returns !== undefined ? returns : this;
		}
	};
} ) );
