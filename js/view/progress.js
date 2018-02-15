define([
    'utils/extend',
    'jquery'
], function(
    extend,
    $
) {

var ProgressView = function(elem) {
    this._domElem = $('<div/>')
        .addClass('progress')
        .append($('<div/>')
            .addClass('progress-bar'))
        .appendTo($(elem || 'body'));
};

extend(ProgressView.prototype, {
    show : function() {
        this._domElem.addClass('progress_visible');
        return this;
    },

    hide : function() {
        this._domElem.removeClass('progress_visible');
        return this;
    },

    setVal : function(val) {
        this._domElem.find('.progress-bar').css({ width : (100 * val) + '%' });
        return this;
    }
});

return ProgressView;

});