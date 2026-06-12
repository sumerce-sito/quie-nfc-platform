'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.DYNAMODB_TABLE_ESCANEOS || 'quie_escaneos';

let _client = null;

function getClient() {
  if (!_client) {
    const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
    _client = DynamoDBDocumentClient.from(dynamo);
  }
  return _client;
}

async function registrarEscaneoDynamo({ codigo_id, ip, ciudad, dispositivo, pais }) {
  const timestamp = new Date().toISOString();
  await getClient().send(new PutCommand({
    TableName: TABLE,
    Item: { codigo_id, timestamp, ip, ciudad, dispositivo, pais }
  }));
  return timestamp;
}

module.exports = { registrarEscaneoDynamo };
