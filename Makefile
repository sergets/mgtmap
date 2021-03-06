COLORING=default

.PHONY: dev install clean actuals deploy

dev:
	python -m SimpleHTTPServer ${PORT} || python -m http.server ${PORT}

clean:
	rm -rf ./node_modules
	rm -rf ./deploy
	rm -rf ./actuals
	rm -rf ./tiles

actuals: install
	mkdir -p actuals
	node tools/make-actuals.js ${COLORING} 1
	node tools/make-actuals.js ${COLORING} 32
	node tools/make-actuals.js ${COLORING} 64

tiles: install
	mkdir -p tiles
	node tools/make-tiles.js ${COLORING} 1
	node tools/make-tiles.js ${COLORING} 32
	node tools/make-tiles.js ${COLORING} 64

deploy: install actuals tiles
	node node_modules/requirejs/bin/r.js -o tools/app.build.js
	node node_modules/requirejs/bin/r.js -o tools/worker.build.js
	cat index.html | sed 's/\(<!-- \[development\]\) -->/\1 /g;s/<!-- \(\[\/development\] -->\)/ \1/g;s/\(<!-- \[production\]\)/\1 -->/g;s/\(\[\/production\] -->\)/<!-- \1/g' > deploy/index.html
	cp CNAME deploy/
	cp index.css deploy/
	cp troll-logo.png deploy/
	cp -r data deploy/
	cp -r actuals deploy/
	cp -r tiles deploy/

install:
	yarn install
