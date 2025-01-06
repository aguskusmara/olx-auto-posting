const Olx = require("./olx.js");
const clients = new Map();

function getClient(id) {
  return clients.get(id);
}

function deleteClient(id){
  clients.delete(id)
} 

async function initClient(email, password) {
  const olx = new Olx(email, password);
  await olx.auth();
  await olx.getMe();
  return olx;
}

module.exports = { clients, Olx };
