#!/bin/bash

# Usage: scripts/process-images.sh <images...>
# e.g.   scripts/process-images.sh /data/pdf-images/f-*.png

THUMB_SIZE=300x429
MEDIUM_SIZE=700x1001

echo 'will cite' | parallel --citation > /dev/null 2>&1

n=0

for file in "$@"; do
  dir=`dirname "$file"`
  name=`basename "$file"`
  if [[ $name != "f-"* ]]; then
    echo >2 invalid filename for $file
    exit 1
  fi

  thumb_file=$dir/${name/f-/t-}
  medium_file=$dir/${name/f-/m-}

  n=$((n+1))
  echo prepare $n/$# $file
  [ -f $thumb_file ] || sem -q -j+0 --id resize-img convert -rotate '90>' -resize "$THUMB_SIZE!" $file $thumb_file
  [ -f $medium_file ] || sem -q -j+0 --id resize-img convert -rotate '90>' -resize "$MEDIUM_SIZE!" $file $medium_file
done

sem --wait --id pdf-img
