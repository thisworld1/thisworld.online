#!/bin/bash

# Usage: scripts/generate-images.sh <target dir for images> <source pdfs...>
# e.g.   scripts/generate-images.sh /data/pdf-page-images/ /data/pdfs/*.pdf

opt='-png -transp'

dest_base="$1"; shift

echo 'will cite' | parallel --citation > /dev/null 2>&1

for file in "$@"; do
  issue_num=`echo $file | egrep -o 'B-I[0-9]+' | sed 's/^B-I0*//'`
  dest="$dest_base/$issue_num"

  echo "Extracting images from issue #$issue_num at $file to $dest"

  mkdir -p $dest
  sem -j+0 --id pdf-img pdftocairo $opt $file $dest/f
done

sem --wait --id pdf-img

# strip leading zeroes from filename
rename 's/f-0+/f-/' $dest_base/*/f-0*.png
