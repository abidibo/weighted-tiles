var WeightedTiles;
(function($, undefined) {
    /**
     * Draws items tiles inside an area w*h, optmizing space and tiles weight
     * Tiles with more relevance are bigger and placed in the top of the area.
     * There is a tolerance of 20% for the area height (tiles may exceed the area height of 20%).
     * The algoritm can run 6 different configurations, each with different criteria, and then take the one which minimizes the empty left space in the area.
     * Criteria are eligible through options, provide only one (maybe the first ['Up', 'Down']) for better performance, provide all for better result
     * @param {Array} items items to be tiled, array of objects {weight: WEIGHT, id: ID}
     * @param {Number} w area width
     * @param {Number} h area height
     * @param {Object} options
     * @param {Number} options.max_ratio maximum ratio allowed h/w for a tile. Default 3.
     * @param {Number} options.log_verbosity console log verbosity. It influences a lot the performance, set to 0 in production. Also do not set to 5 with more than 
     *                                       one criteria because it is overkilling!
     * @param {Boolean} options.get_all_configurations Whether to receive all the configurations or only the one which optimizes left empty space
     * @param {Object} options.criteria criteria used to try different configurations
     * @param {Number} options.max_attempts maximum loop number when placing items. Set a greater value if you find bad positioned tiles
     * @param {String} options.item_el_tile_class css class given to all items elements
     * @param {String} options.item_el_weight_class css dynamic weight class given to all items elements (w1, w2...)
     * @param {Function} options.callback The function called when the process ends. It receives this ibject as context, and a parameter which is:
     *                                    - an array of configurations results if get_all_configurations is true
     *                                    - a configuration object if get_all_configurations is false.
     *                                    Each configuration object has the following properties:
     *                                    - criteria: array of criteria strings which identifies the configuration
     *                                    - id: configuration id
     *                                    - empty: number of left empty unit grids
     *                                    - elements: the jquery elements matching the items
     *                                    Each element is a jquery element, with extra properties:
     *                                    - item: the matching item
     *                                    - x0, x, y0, y the unit grid coordinates
     *                                    By default the html of the element contains the string 'WEIGHT - ITEM_ID'
     *
     */
    WeightedTiles = function(items, w, h, options) {

        var opts = {
            max_ratio: 3,
            log_verbosity: 5,
            get_all_configurations: true,
            criteria: {
                0: ['Up', 'Down'],
                1: ['Down', 'Up'],
                2: ['UpPosition', 'DownPosition'],
                3: ['DownPosition', 'UpPosition'],
                4: ['Up', 'DownPosition'],
                5: ['Down', 'UpPosition']
            },
            max_attempts: 10000,
            item_el_tile_class: 'tile',
            item_el_weight_class: 'w',
            callback: function(obj) { console.log(obj); }
        };

        this._init = function(items, w, h, options) {

            // define properties
            this._items = items;
            this._w = w;
            this._h = h;
            this._cache = { factors: {} };

            // options
            this._options = $.extend({}, opts, options);

            // total area available
            var area = w * h;
            this.log(4, 'area: ', area);

            // items weight sum
            this._weight_sum = this._weightSum();
            this.log(4, 'weight sum: ', this._weight_sum);

            // weight unit for the given area
            this._weight_unit = Math.floor(area / this._weight_sum);
            this.log(3, 'weight unit: ', this._weight_unit);

            // items ordered by descendant weight
            this._ordered_items = this._items.sort(function(a, b) { return a.weight > b.weight ? -1 : 1 });
            this.log(4, 'ordered items: ', this._ordered_items);

            // let's create a grid made of weight units (or a divisor)
            // the grid must be all contained inside area
            this._makeGrid();

            // and now draw items, try with configurations
            var configuration_id = 0;
            // store all configurations to determine which is the best fit
            this._configurations = [];
            while(configuration_id < Object.keys(this._options.criteria).length) {
                this._configure(configuration_id);
                configuration_id++;
            }

            // configurations ordered by crescent empty left space
            this._ordered_conf = this._configurations.sort(function(a, b) { return a.empty > b.empty ? -1 : 1 });
            this.log(3, 'ordered configurations: ', this._ordered_conf);

            if(this._options.get_all_configurations) {
                this._options.callback.call(this, this._ordered_conf);
            }
            else {
                this._options.callback.call(this, this._ordered_conf[this._ordered_conf.length - 1]);
            }
        };

        /**
         * Calculates the items' weights sum
         * Each weight is doubled in order to have an even sum (not strange shapes made of n odd units)
         */
        this._weightSum = function() {
            var sum = 0;
            for (var i = 0, len = this._items.length; i < len; i++) {
                sum = sum + (this._items[i].weight * 2);
            }
            return sum;
        };

        /**
         * Creates a weight unit grid all contained inside the area
         * If necessary the grid unit dimensions are halved
         */
        this._makeGrid = function() {

            this.log(4, 'making grid');

            var ratio = 1;
            var go = true;
            var num = this._weight_sum;
            // ratio used to limit cycles and prevent infinite loop, a result actually should be found within 10 loops
            while(go && ratio < 10) {
                try {

                    this.log(4, 'unit weight ratio: ', ratio);
                    // unit side (square so sqrt)
                    var side = Math.floor(Math.sqrt(this._weight_unit) / ratio);

                    var cols = Math.floor(this._w / side);
                    var rows = Math.ceil(num / cols);

                    this.log(4, 'rows*side', rows*side);
                    this.log(4, 'h', this._h);

                    // if the grid exceeds the allowed height an exception is thrown, then when catched the loop is started again but
                    // this time halving the unit dimensions
                    if(rows * side > this._h) {
                        throw "unit weight grid h overflow";
                    }

                    this.log(4, 'grid found');
                    this.log(4, 'covered_area: ', num * side * side);
                    this.log(4, 'grid unit side: ', side, ' - ratio: ', ratio);
                    this.log(4, 'grid units: ', num);
                    this.log(4, 'grid cols: ', cols);
                    this.log(4, 'grid rows: ', rows);

                    // item area: weight * 2 * ratio * ratio
                    this._ratio = ratio;
                    this._grid_side = side;
                    this._grid_units = num;
                    this._grid_cols = cols;
                    this._grid_rows = rows;
                    go = false;
                }
                catch(exception) {
                    this.log(4, 'unit weight grid failed, retrying with next ratio');
                    ratio++;
                    num = this._weight_sum * ratio * ratio;
                }
            }
        };

        /**
         * Runs a configuration
         * @param {Number} id configuration id
         */
        this._configure = function(id) {

            // init the configuration
            this._initConfiguration(id);
            // loop to place the items
            for (var i = 0, len = this._ordered_items.length; i < len; i++) {
                this.placeItem(this._ordered_items[i], i);
            }
            // how much space was left empty by the configuration?
            var empty = 0;
            for(i = 0, l = this._grid_cols; i < l; i++) {
                for(ii = 0, ll = this._grid_rows; ii < ll; ii++) {
                    if(typeof(this._units_filled[i + '-' + ii]) == 'undefined') {
                        empty++;
                    }
                }
            }
            this.log(4, 'configuration ' + this._configuration_id + ', empty: ', empty);

            // store the configuration
            this._configurations.push({
                'id': this._configuration_id,
                'criteria': this._options.criteria[this._configuration_id],
                'empty': empty,
                'elements': this._filled
            });
        };

        /**
         * Initializes the configuration
         */
        this._initConfiguration = function(id) {
            this._configuration_id = id;
            this._filled = [];
            this._units_filled = {};
        };

        /**
         * Places the item using the criteria tied to the active configuration id
         * @param {Object} item the item to place
         * @param {Number} index the item index
         */
        this.placeItem = function(item, index) {

            // gets the first free position coordinates
            this._position = this._getPosition();
            // how many units for the item shape?
            var item_units = (item.weight * 2) * this._ratio * this._ratio;

            // try first with a w~h shape
            var factors = this.factors(item_units);
            // crate a bit of entropy
            var f = factors[Math.floor(factors.length / 2) + (index % 2)];
            var w_units = f;
            var h_units = item_units / f;

            var cnt = 1;
            var collision = this._collide(w_units, h_units);

            this.log(4, 'placing item id: ', item.id, ', configuration id: ', this._configuration_id)

            if(!collision) {
                this.log(4, 'placed at first attempt');
            }

            var criteria = this._options.criteria[this._configuration_id];
            while(cnt < this._options.max_attempts && collision === true) {
                for(var i = 0, l = 2; i < l; i++) {
                    var r = this['change' + criteria[i]](factors, item_units);
                    if(r !== false) {
                        var w_units = r[1];
                        var h_units = r[2];
                        collision = false;
                        break;
                    }
                }
                if(collision && (this._configuration_id == 0 || this._configuration_id == 1)) {
                    this._position = (this._position[0] + 1) > this._grid_cols ? [0, this._position[1] + 1] : [this._position[0] + 1, this._position[1]];
                }
                cnt++;
            }

            if(collision) {
                this.log(2, 'placed overflow detected, no position found for item: ', item.id);
            }

            // dom element
            var el = $('<div/>').addClass(this._options.item_el_tile_class + ' ' + this._options.item_el_weight_class + item.weight).css({
                position: 'absolute',
                left: (this._position[0] * this._grid_side) + 'px',
                top: (this._position[1] * this._grid_side) + 'px',
                width: (w_units * this._grid_side) + 'px',
                height: (h_units * this._grid_side) + 'px',
                background: this.getRandomColor()
            }).html(item.weight + ' - ' + item.id);
            // add extra properties to el
            el.item = item;
            // store occupied units
            el.x0 = this._position[0];
            el.x = el.x0 + w_units;
            el.y0 = this._position[1];
            el.y = el.y0 + h_units;
            this._filled.push(el);
            // update grid units filled
            for(i = this._position[0], l = this._position[0] + w_units; i < l; i++) {
                for(ii = this._position[1], ll = this._position[1] + h_units; ii < ll; ii++) {
                    this._units_filled[i + '-' + ii] = 1;
                }
            }

        };

        /**
         * Up criteria
         * Different shapes are tried to place the item starting at the current position.
         * The first shape width is the middle indexed factor of the item area, then 
         * the next one and so on (increasing width)
         * @param {Array} factors factors of the total number of grid units occupied by the item
         * @param {Number} item_units grid units occupied by the item
         * @return false if element cannot be placed, [true, w_units, h_units] instead, 
         *         where w_units: units in the x axis, h_units: units in the y axis (defining the shape)
         */
        this.changeUp = function(factors, item_units) {
            for(var i = Math.floor(factors.length / 2) , l = factors.length - 1; i < l; i++) {
                f = factors[i];
                h_units = item_units / f;
                w_units = f;
                collision = this._collide(w_units, h_units);
                if(!collision) {
                    this.log(4, 'placed with Up criteria')
                    return [true, w_units, h_units];
                    break;
                }
            }
            return false;
        };

        /**
         * UpPosition criteria
         * Different shapes are tried to place the item starting at the current position.
         * For each shape all positions are tried before changing shape.
         * The first shape width is the middle indexed factor of the item area, then 
         * the next one and so on (increasing width)
         * @param {Array} factors factors of the total number of grid units occupied by the item
         * @param {Number} item_units grid units occupied by the item
         * @return false if element cannot be placed, [true, w_units, h_units] instead, 
         *         where w_units: units in the x axis, h_units: units in the y axis (defining the shape)
         */
        this.changeUpPosition = function(factors, item_units) {
            for(var i = Math.floor(factors.length / 2) , l = factors.length - 1; i < l; i++) {
                f = factors[i];
                h_units = item_units / f;
                w_units = f;
                for(i = 0, l = this._grid_units; i < l; i++) {
                    collision = this._collide(w_units, h_units);
                    if(!collision) {
                        this.log(4, 'placed with UpPosition criteria')
                        return [true, w_units, h_units];
                        break;
                    }
                    this._position = (this._position[0] + 1) > this._grid_cols ? [0, this._position[1] + 1] : [this._position[0] + 1, this._position[1]];
                }
            }
            return false;
        };

        /**
         * Down criteria
         * Different shapes are tried to place the item starting at the current position.
         * The first shape width is the middle - 1 indexed factor of the item area, then 
         * the prev one and so on (decreasing width)
         * There is also a constraint for the h/w ratio (to thin tiles cannot contain good text)
         * @param {Array} factors factors of the total number of grid units occupied by the item
         * @param {Number} item_units grid units occupied by the item
         * @return false if element cannot be placed, [true, w_units, h_units] instead, 
         *         where w_units: units in the x axis, h_units: units in the y axis (defining the shape)
         */
        this.changeDown = function(factors, item_units) {
            for(var i = Math.floor(factors.length / 2) - 1; i > -1; i--) {
                f = factors[i];
                h_units = item_units / f;
                w_units = f;
                if(h_units / w_units <= this._options.max_ratio) {
                    collision = this._collide(w_units, h_units);
                    if(!collision) {
                        this.log(4, 'placed with Down criteria')
                        return [true, w_units, h_units];
                        break;
                    }
                }
                else {
                    break;
                }
            }
            return false;
        };

        /**
         * DownPosition criteria
         * Different shapes are tried to place the item starting at the current position.
         * For each shape all positions are tried before changing shape.
         * The first shape width is the middle - 1 indexed factor of the item area, then 
         * the prev one and so on (decreasing width)
         * There is also a constraint for the h/w ratio (to thin tiles cannot contain good text)
         * @param {Array} factors factors of the total number of grid units occupied by the item
         * @param {Number} item_units grid units occupied by the item
         * @return false if element cannot be placed, [true, w_units, h_units] instead, 
         *         where w_units: units in the x axis, h_units: units in the y axis (defining the shape)
         */
        this.changeDownPosition = function(factors, item_units) {
            for(var i = Math.floor(factors.length / 2) - 1; i > -1; i--) {
                f = factors[i];
                h_units = item_units / f;
                w_units = f;
                for(i = 0, l = this._grid_units; i < l; i++) {
                    if(h_units / w_units <= this._options.max_ratio) {
                        res = this._collide(w_units, h_units);
                        if(!res) {
                            this.log(4, 'placed with DownPosition criteria')
                            return [true, w_units, h_units];
                            break;
                        }
                    }
                    else {
                        break;
                    }
                    this._position = (this._position[0] + 1) > this._grid_cols ? [0, this._position[1] + 1] : [this._position[0] + 1, this._position[1]];
                }
            }
            return false;
        };

        /**
         * gets the position of the first not filled grid unit
         */
        this._getPosition = function() {
            for(i = 0, l = this._grid_rows + 1; i < l; i++) {
                for(ii = 0, ll = this._grid_cols + 1; ii < ll; ii++) {
                    if(this.checkPosition(ii, i)) {
                        return [ii, i];
                    }
                }
            }
        };

        /**
         * Check if the given grid unit is filled
         * @param {Number} x x coordinate
         * @param {Number} y y coordinate
         * @return true is empty, false otherwise
         */
        this.checkPosition = function(x, y) {
            if(typeof this._units_filled[x + '-' + y] !== 'undefined' && this._units_filled[x + '-' + y]) {
                return false;
            }
            if(x + 1 > this._grid_cols) {
                return false;
            }
            return true;
        };

        /**
         * Checks if the given w*h shapes collides with borders or other tiles.
         * A tolerance of 20% in height dimension is taken into account
         * @param {Number} w number of grid units in width
         * @param {Number} h number of grid units in height
         * @return true if a collision is detected, false otherwise
         */
        this._collide = function(w, h) {

            var log = this._options.log_verbosity == 5 ? true : false;

            var x0 = this._position[0];
            var x1 = x0 + w;
            var y0 = this._position[1];
            var y1 = y0 + h;

            if(x1 > this._grid_cols) {
                if(log) this.log(5, 'w_units: ', w,  ' overflow x detected', x0, y0, w, h);
                return true;
            }
            if(y1 > this._grid_rows + (this._grid_rows * 0.2)) {
                if(log) this.log(5, 'w_units: ', w,  ' overflow y detected', x0, y0, w, h);
                return true;
            }

            for(var i = 0, l = this._filled.length; i < l; i++) {
                var el = this._filled[i];

                if(x1 > el.x0 && x0 < el.x) {
                    if(y1 > el.y0 && y0 < el.y) {
                        if(log) this.log(5, 'tiles collision detected', x0, y0, w, h);
                        return true;
                    }
                }
            };

            if(log) this.log(5, 'w_units: ', w,  ' no collision detected');
            return false;
        };

        /**
         * Calculates the factors of the given number
         * A cache system is used because it could be an expensive task
         * @param {Number} num
         * @return array of factors
         */
        this.factors = function(num) {

            // search first in cache
            if(typeof this._cache.factors !== 'undefined' && typeof this._cache.factors[num] !== 'undefined') {
                return this._cache.factors[num];
            }

            var half = Math.floor(num / 2),
                factors = [1], // 1 will be a part of every solution.
                i, j;

            // Determine our increment value for the loop and starting point.
            num % 2 === 0 ? (i = 2, j = 1) : (i = 3, j = 2);

            for (i; i <= half; i += j) {
                num % i === 0 ? factors.push(i) : false;
            }

            factors.push(num) // Always include the original number.

            // store in cache
            this._cache.factors[num] = factors;

            return factors;
        };

        /**
         * For testing purposes: use this function to get a random bkg color for the tiles
         */
        this.getRandomColor = function() {
            var letters = '0123456789ABCDEF'.split('');
            var color = '#';
            for (var i = 0; i < 6; i++ ) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        };

        /**
         * Console log if verbosity option is greater or equal to log importance
         */
        this.log = function() {
            if([].shift.call(arguments) <= this._options.log_verbosity) {
                console.log.apply(console, arguments);
            }
        };

        /**
         * Displays all (5 seconds each) or the best configuration found inside the given canvas
         * Also displays information about current displayed configuration and empty units
         */
        this.display = function(canvas) {
            var conf_div = $('<div/>', {id: 'configuration'}).css({
                position: 'absolute',
                top: 0,
                right: 0
            }).appendTo($('body'));
            if(this._options.get_all_configurations) {
                var self = this;

                this._ordered_conf.forEach(function(conf, index) {
                    setTimeout(function() {
                        $(canvas).empty();
                        conf_div.html(conf.criteria.toString() + '<br />' + 'empty: ' + conf.empty);
                        conf.elements.forEach(function(el) {
                            el.appendTo($(canvas));
                        })
                    }, index * 5000);
                });
            }
            else {
                var conf = this._ordered_conf[this._ordered_conf.length - 1];
                conf.elements.forEach(function(el) {
                    conf_div.html(conf.criteria.toString() + '<br>' + 'empty: ' + conf.empty);
                    el.appendTo($(canvas));
                });
            }
        };

        /** let's start! */
        this._init(items, w, h, options);

    }
})(jQuery, undefined);
