define(['jquery'], function($) {
    return {
        _getEventsEmitter : function() {
            return this._jqEventsEmitter || (this._jqEventsEmitter = $(this));
        },
        
        _bindHandler : function(handler, ctx) {
            var boundHandler = handler.bind(ctx);
            (this._handlersToUnbind || (this._handlersToUnbind = [])).push({ handler : handler, ctx : ctx, boundHandler : boundHandler });
            return boundHandler;
        },
        
        trigger : function(e, data) {
            this._getEventsEmitter().trigger(e, data);
            return this;
        },
        
        once : function(e, handler, ctx) {
            this._getEventsEmitter().one(e, ctx? this._bindHandler(handler, ctx) : handler);
            return this;
        },
        
        on: function(e, handler, ctx) {
            if (typeof e == 'object') {
                Object.keys(e).forEach(function(eventName) {
                    this.on(eventName, e[eventName], handler); 
                }, this);
            } else {
                this._getEventsEmitter().bind(e, ctx? this._bindHandler(handler, ctx) : handler);
            }
            return this;
        },
        
        un: function(e, handler, ctx) {
            var boundHandler = ctx && (this._handlersToUnbind || []).find(function(item) {
                return item.handler == handler && item.ctx == ctx;
            });
            this._getEventsEmitter().unbind(e, ctx? boundHandler.boundHandler : handler);
            boundHandler && this._handlersToUnbind.splice(this._handlersToUnbind.indexOf(boundHandler), 1);
        }
    };
});