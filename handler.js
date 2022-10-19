'use strict';

const axios = require('axios');
const AWS = require('aws-sdk');
const { XMLParser, XMLBuilder } = require("fast-xml-parser");

const s3 = new AWS.S3();
const cloudFront = new AWS.CloudFront()
module.exports.save = (event, context, callback) => {
  const { BUCKET_NAME, SITEMAP, NEW_HOST, DISTRIBUTION_KEY, FILE_NAME } = process.env;
  axios(SITEMAP)
    .then(response => {
      const parser = new XMLParser();
      let xmlData = parser.parse(response.data);
      for (let i = 0; i < xmlData.urlset.url.length; i++) {
        const url = new URL(xmlData.urlset.url[i].loc);
        xmlData.urlset.url[i].loc = `${NEW_HOST}${url.pathname}${url.search}`;
      }

      const builder = new XMLBuilder();
      const xmlContent = builder.build(xmlData);
      return s3.putObject({
        Bucket: BUCKET_NAME,
        Key: FILE_NAME,
        Body: xmlContent,
      }).promise()
    }).then(v => {
      const cloudfrontConfig = {
        DistributionId: DISTRIBUTION_KEY,
        InvalidationBatch: {
          CallerReference: 'cf-invalidate-' + Date.now(),
          Paths: {
            Quantity: 1,
            Items: [
              `/${FILE_NAME}`,
            ]
          }
        }
      };
      return cloudFront.createInvalidation(cloudfrontConfig).promise();
    })
    .then(v => callback(null, { success: "ok" }), callback);
};