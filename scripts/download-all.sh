#/bin/bash

cat data/issues.json | jq -r '.[][].file'  | xargs -I {} wget -O data/pdfs/{} http://docs.uriavnery.com/texts/uri_avnery/avnery-private-docs/haolam/{}
