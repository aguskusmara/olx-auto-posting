const Olx = require("./olx.js");
const clients = new Map();

async function delay(ms = 500) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, ms);
  });
}

function getClient(id) {
  return clients.gedeleteAdByIdst(id);
}

function deleteClient(id) {
  clients.delete(id);
}

async function initClient({ email, password, headers }) {
  const olx = new Olx(email, password, headers);
  const { error, success, data } = await olx.auth();
  if (error) {
    return { error };
  }
  await olx.getMe();
  clients.set(email, olx);
  return { success, data };
}

async function postingAds({ user, data, IS_TESTING }) {
  let client = clients.get(user.email);
  if (!client) {
    client = new Olx(user.email, user.password, user.headers);
    await client.auth();
  }
  console.log(37);
  const ads = await client.createAd(data, IS_TESTING);
  console.log(38);
  if (IS_TESTING) {
    return {
      message: "testing done",
      olad_id: "test",
      ad_id: "test",
    };
  }
  const id = await client.postingAd(ads);
  console.log(48);
  console.log({id})
  return id;
}

// async function getAdByid({user, olad_id}){
//   let client = clients.get(user.email);
//   console.log('okokokko')
  
//   if (!client) {
//     client = new Olx(user.email, user.password, user.headers);
//     await client.auth();
//   }  
//   await client.getOladByid(olad_id)
// }

// getAdByid({user:{
//   email: 'olxastra.kranji002@gmail.com',
//   password: 'Agus1980@'
// },olad_id:'1550831'})

async function editAds({ user, data, id, olx_id }) {
  let client = clients.get(user.email);
  if (!client) {
    client = new Olx(user.email, user.password, user.headers);
    await client.auth();
  }
  try {
    await client.getAdByid(olx_id);
  } catch (err) {
    return { message: "Iklan tidak ditemukan" };
  }
  const adId = await client.editAdById(id, data);
  return adId;
}

async function deleteAdById({ user, id, olx_id }) {
  let client = clients.get(user.email);
  if (!client) {
    client = new Olx(user.email, user.password, user.headers);
    await client.auth();
  }
  try {
    await client.getAdByid(olx_id);
  } catch (err) {
    console.log(err.message);
    return { message: "Iklan tidak ditemukan" };
  }
  const adId = await client.deleteAdById(id);
  return adId;
}

async function archiveAdByIds({ user, ids }) {
  let client = clients.get(user.email);
  if (!client) {
    client = new Olx(user.email, user.password, user.headers);
    await client.auth();
  }
  const results = [];
  for (let { id, row, olx_id } of ids) {
    const adId = await client.archiveAdById(id);
    results.push({ ...adId, id, row });
  }
  return results;
}


async function deleteAdByIds({ user, ids }) {
  let client = clients.get(user.email);
  if (!client) {
    client = new Olx(user.email, user.password, user.headers);
    await client.auth();
  }
  const results = [];
  for (let { id, row, olx_id } of ids) {
    try {
      await client.getAdByid(olx_id);
    } catch (err) {
      console.log(err.message);
      results.push({ message: "Iklan tidak ditemukan", id, row });
      continue;
    }
    const adId = await client.deleteAdById(id);
    results.push({ ...adId, id, row });
  }
  return results;
}

async function sundulAd({ user, limit, offset }) {
  let client = clients.get(user.email);
  if (!client) {
    client = new Olx(user.email, user.password, user.headers);
    await client.auth();
  }
  const packages = await client.getQuota();

  const { ads, total } = await client.getAllAds(limit, offset, true);
  console.log({ totalIklan: total, ads: ads.length, offset, user });
  let totalSundul = 0;
  if (packages.length) {
    let indexPaket = 0;
    let paket = packages[indexPaket];
    for (let i = 0; i < ads.length; i++) {
      // console.log(paket);
      if (!paket.quota) {
        indexPaket++;
        paket = packages[indexPaket];
      }
      const adId = ads[i].id;
      try {
        const status = await client.sundulAdsByid(adId, paket.package_id);
        // console.log(status);
        totalSundul++;
        paket.quota--;
      } catch (err) {
        await delay(800);
        console.log({ ...err, user });
      }
      console.log({ totalSundul });
    }
  } else {
    return {
      success: false,
      totalSundul,
      totalActiveAds: total,
      message: "paket sundul tidak tersedia",
      hasNext: false,
    };
  }
  console.log({ totalSundul, ads: ads.length, limit });
  const remainQuota = packages.reduce((a, b) => (a += b.quota), 0);
  return {
    success: true,
    totalSundul,
    totalActiveAds: total,
    packages,
    remainQuota,
    hasNext: ads.length > 0,
  };
}

module.exports = {
  clients,
  Olx,
  initClient,
  deleteClient,
  getClient,
  postingAds,
  editAds,
  sundulAd,
  deleteAdById,
  deleteAdByIds,
  archiveAdByIds
};
