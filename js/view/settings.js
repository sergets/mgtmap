define([
    'utils/extend',
    'utils/events-emitter',
    'jquery'
], function(
    extend,
    eventsEmitter,
    $
) {

var colorings = {
    'default': 'обычные цвета',
    'vendor': 'по перевозчику',
    'type': 'по типу',
    'black': 'все чёрные'
};

var SettingsView = function(elem, state) {
    this._domElem = $('<div/>')
        .addClass('settings')
        .append(this._button = $('<div/>')
            .addClass('settings__button')
            .click(this.open.bind(this))
        )
        .append(this._popup = $('<form/>')
            .submit(this._onSubmit.bind(this))
            .addClass('settings__popup')
            .append($('<div/>').addClass('settings__close').click(this.close.bind(this)))
            .append($('<h2/>').addClass('settings__title').text('Настройки'))
            .append($('<div/>').text('Маршруты по состоянию на')
                .append(this._dateInput = $('<input/>')
                    .attr('type', 'date')
                    .addClass('settings__input settings__date')
                    .val(new Date(state.timeSettings.date).toISOString().substr(0, 10))
                )
            )
            .append($('<div/>').text('Толщина линий — частота рейсов за время')
                .append($('<div/>').addClass('settings__times')
                    .append($('<div/>').addClass('settings__time-scale')
                        .append(Array.apply(Array, Array(25)).map(function(val, i) {
                            return $('<div/>').addClass('settings__time-scale-hour').text((i + 3) % 24);
                        }))
                    )
                    .append($('<div/>').addClass('settings__ranges')
                        .append(this._fromTimeInput = $('<input/>')
                            .attr({ type: 'range', min: 3, max: 27, step: 1 })
                            .addClass('settings__range settings__from-time')
                            .val(state.timeSettings.fromHour)
                        )
                        .append(this._toTimeInput = $('<input/>')
                            .attr({ type: 'range', min: 3, max: 27, step: 1 })
                            .addClass('settings__range settings__to-time')
                            .val(state.timeSettings.toHour)
                        )
                    )
                )
            )
            .append($('<div/>').text('Раскраска')
                .append(this._coloringInput = $('<select/>').addClass('settings__input settings__select settings__coloring')
                    .append(Object.keys(colorings)
                        .map(function(id) {
                            return $('<option/>').val(id).text(colorings[id]).attr('selected', state.customColoringId == id);
                        })
                    )
                )
            )
            .append($('<div/>').text('Сделать все линии')
                .append(this._widthFactorInput = $('<select/>').addClass('settings__input settings__select settings__width-factor')
                    .append($('<option/>').val(3).text('в три раза толще').attr('selected', state.widthFactor == 3))
                    .append($('<option/>').val(1).text('обычной толщины').attr('selected', state.widthFactor == 1))
                    .append($('<option/>').val(.33).text('в три раза тоньше').attr('selected', state.widthFactor == .33))
                    .append($('<option/>').val(0).text('одинаковой толщины').attr('selected', state.isEqualWidthsMode))
                )
            )
            .append($('<input/>').addClass('settings__submit').attr('type', 'submit').val('Применить'))
        )
        .appendTo($(elem || 'body'));
};

extend(SettingsView.prototype, eventsEmitter);

extend(SettingsView.prototype, {
    open : function() {
        this._popup.addClass('settings__popup_visible');
        return this;
    },

    close : function() {
        this._popup.removeClass('settings__popup_visible');
        return this;
    },

    _onSubmit : function(e) {
        e.preventDefault();

        var date = this._dateInput.val() && new Date(this._dateInput.val()),
            dow = date && 1 << ((date.getDay()? date.getDay() : 7) - 1);
            res = {};

        res.timeSettings = {
            fromHour: this._fromTimeInput.val(),
            toHour: this._toTimeInput.val()
        };

        if (date) {
            res.timeSettings.date = +date;
            res.timeSettings.dow = dow;
        }

        res.customColoringId = this._coloringInput.val();
        res.isEqualWidthsMode = this._widthFactorInput.val() == 0;
        res.widthFactor = +this._widthFactorInput.val() || 3;

        this.trigger('change', res);
        this.close();
        return false;
    }
});

return SettingsView;

});