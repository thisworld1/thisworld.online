#!/bin/bash

(cat node_modules/jquery/dist/jquery.min.js && echo -en '\n;' &&
 cat node_modules/bootstrap-autocomplete/dist/latest/bootstrap-autocomplete.min.js && echo -en ';\n' &&
 cat node_modules/@popperjs/core/dist/umd/popper.min.js && echo -en ';\n' &&
 cat node_modules/tippy.js/dist/tippy-bundle.umd.min.js && echo -en ';\n' &&
 cat node_modules/mark.js/dist/mark.es6.min.js && echo -en ';\n' &&
 cat www/script.js) | terser -c -m > www/bundle.js

stylus --compress < www/style.styl > www/style.css

