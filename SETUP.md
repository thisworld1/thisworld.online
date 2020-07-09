# Setup

```
$ git clone https://github.com/thisworld1/thisworld.online olam && cd olam
$ mkdir -p data/{pdfs,pages}
# place pdfs in data/pdfs/
$ docker-compose up
```

### Build the Solr index
```
$ docker exec -it olam_webapp_1 sh -c 'node src/index-pdf.js /data/pdfs/*.pdf'

$ docker exec -it olam_webapp_1 curl 'http://solr:8983/solr/olam/suggest?suggest=true&suggest.build=true'
```

### Generate images
```bash
# Generate full-sized images from the PDFs (written to data/pages/{issue-num}/f-{page-num}.png)
$ docker exec -it olam_webapp_1 sh -c 'scripts/generate-images.sh /data/pages/ /data/pdfs/*.pdf'

# Generate thumbnails from the full-sized images (written to the same directory with the t- and m- prefixes)
$ docker exec -it olam_webapp_1 sh -c 'scripts/process-images.sh /data/pages/*/f-*.png'
```
