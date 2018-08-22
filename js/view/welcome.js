define([
    'utils/extend',
    'utils/events-emitter',
    'jquery'
], function(
    extend,
    eventsEmitter,
    $
) {

var WelcomeView = function(elem, className, buttonText, header, content) {
    this._domElem = $('<div/>')
        .addClass('welcome')
        .addClass(className)
        .append(this._button = $('<div/>')
            .addClass('welcome__button')
            .text(buttonText)
            .click(this.open.bind(this))
        )
        .append(this._popup = $('<div/>')
            .addClass('welcome__popup')
            .append($('<div/>').addClass('welcome__close').click(this.close.bind(this)))
            .append($('<h2/>').addClass('welcome__title').text(header))
            .append(typeof content == 'string' ?
                $('<div/>').addClass('welcome__content').html(content) :
                $('<div/>').addClass('welcome__content').append(content))
        )
        .appendTo($(elem || 'body'));

    this._domElem.find('.welcome__link').click(this.close.bind(this));
    this._domElem.find('.welcome__table-link').click(function() {
        this.close();
        this.trigger('show-table');
    }.bind(this));
};

extend(WelcomeView.prototype, eventsEmitter);

extend(WelcomeView.prototype, {
    open : function() {
        this._popup.addClass('welcome__popup_visible');
        this.trigger('opened');
        return this;
    },

    close : function() {
        this._popup.removeClass('welcome__popup_visible');
        this.trigger('closed');
        return this;
    }
});

return WelcomeView;

});