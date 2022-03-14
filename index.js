var xrpl = require("xrpl");
const vega = require('vega')
const lite = require('vega-lite')
const fs = require('fs')
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

var publicServer = "wss://s1.ripple.com/" //RPC server
var account = "rGJM9W9bgqAwMwXtPhXMZqm7Xe4vM4endm"
var issuer = "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA"
var startLedgerIndex = 70219529
var ledgerIndexStep = 10000
var throttle = 1 //Number of seconds to throttle each request


const csvWriter = createCsvWriter({
    path: "output.csv",
    header: [
      { id: "ledger_time", title: "ledger_time" },
      { id: "token_balance", title: "token_balance" },
    ],
  });

var data = {
    values: [
    ]
  }

var currentLedger = {
    "command": "ledger",
    "ledger_index": "validated"
  }

var accountLinesRequest = {
  command: "account_lines",
  account: account,
  limit: 400,
  ledger_index: 1,
}

async function getLedger(client, ledgerIndex) {
    var ledgerRequest = currentLedger;
    ledgerRequest.ledger_index = ledgerIndex;
    const response = await client.request(ledgerRequest);
    return response.result;
  }

async function getAccountLines(client, ledger_index) {
  let request = accountLinesRequest;
  request.ledger_index = ledger_index;
  const response = await client.request(request);
  return response.result;
}

function ProcessAccountLines(lines, ledgerTime) {
  for (let i = 0; i < lines.length; i++) {
      if(lines[i].account == issuer)
      {
          console.log('found token balance')
          data.values.push({ledger_time: ledgerTime, token_balance: lines[i].balance})
      }
  }
}

async function main() {

    const client = new xrpl.Client(publicServer);
  try {
    console.log(
        "Starting to Process"
      );
    let marker = undefined;
    let totalAccountLines = 0;
    await client.connect();
    let resp = await getLedger(client, 'validated');
    let latestLedger = resp.ledger_index;
    let currentLedger = startLedgerIndex;
    do{
        try{
            console.log('Processing Ledger Index: ' + currentLedger)
            let respLedgerTime = await getLedger(client, currentLedger);
            let ledgerDateTime = respLedgerTime.ledger.close_time_human;
            let account_lines_response = await getAccountLines(client, currentLedger);
            ProcessAccountLines(account_lines_response.lines, ledgerDateTime);
        } catch(err)
        {
            
        }
        currentLedger = currentLedger + ledgerIndexStep;
        await new Promise((r) => setTimeout(r, throttle * 1000));
    } while(currentLedger <= latestLedger)
    generateVisual();
    console.log("Chart Generated.")
    csvWriter.writeRecords(data.values).then(() => console.log("The CSV file was written successfully"));
  } catch (err) {
    console.log(err);
  } finally {
    await client.disconnect();
  }
}

function generateVisual()
{
    var yourVlSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v2.0.json',
        description: 'A simple bar chart with embedded data.',
        width: 1200,
        height: 800,
        data: data,
        mark: 'bar',
        fontSize: '20px',
        axis:{
            labelFontSize:20
        },
        encoding: {
          x: {field: 'ledger_time', type: 'ordinal'},
          y: {field: 'token_balance', type: 'quantitative'}
        },
        title: {
            text: "account: " + account,
            color: "#ff0000",
            fontSize: "20px",
            anchor: "start"
          },
      };
      let vegaspec = lite.compile(yourVlSpec).spec
      var view = new vega.View(vega.parse(vegaspec), 
      {renderer: "none"})
      view.toSVG()
        .then(function(svg) {
            fs.writeFile('chart.svg', svg, err => {
                if (err) {
                  console.error(err)
                  return
                }
                //file written successfully
              })
        })
        .catch(function(err) { console.error(err); });
}

main();