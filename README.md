# serum_to_s3
A Node JS data pipeline to scrape Serum DEX events and push them to an S3 bucket for use in a Snowflake cluster.

Event schema derived from [SerumTaxTime](https://github.com/SerumTaxTime/SerumTaxTimeApi), node pipeline architecture inspired by [0x Data Pipeline](https://github.com/0xProject/0x-event-pipeline), Serum event scraper code from [Mango Markets' Serum History](https://github.com/blockworks-foundation/serum-history).

The basic logic of the scraper works like this:
1. Pull the Serum markets from Serum's repo
2. Iterate over the markets, [scrape the new trades](https://github.com/blockworks-foundation/serum-history) and append into a CSV
3. Check if the CSV is over 250 MB or not (Snowflake's recommended batch size)
4. If the CSV is over 250 mb, upload it to S3 (Snowpipe takes it over from here) and start a new CSV for the scrapers to append to.

## How the scraper works
The Serum DEX scraper is dependent on the structure of the Serum DEX contracts. The [Serum DEX contracts](https://docs.google.com/document/d/1isGJES4jzQutI0GtQGuqtrBUqeHxl_xJNXdtOv4SdII/edit#) store all filled orders in a rotating buffer - with each order that's pushed onto the queue, the Sequence Number is ratcheted up by one. Thus, you can get the difference in Sequence Number from the JSON RPC response header, and pull the part of the JSON response that corresponds to that number of events.

So, each scraper is responsible for a single market, and keeps track of the Last Sequence Number that it saw in a file in `pipeline/`, pulls the new events based off of this watermark, and then writes the new watermark to it.

## Installation

Use `yarn` to install.
Set up `.env` in the same folder as `sample.env`.

## Running

Use `yarn dev` to run.