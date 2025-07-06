/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */
const axios = require("axios");

const path = require("path"); // <-- Pastikan ini ada
const {
  Olx,
  clients,
  initClient,
  getClient,
  deleteClient,
  postingAds,
  editAds,
  sundulAd,
  deleteAdById,
  deleteAdByIds,
} = require("./src/clients.js");
// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: true,
  keepAliveTimeout: 300000,
  http2SessionTimeout: 300000,
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
// fastify.register(require("@fastify/static"), {
//   root: path.join(__dirname, "public"),
//   prefix: "/", // optional: default '/'
// });

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
  // --- PERBAIKAN PENTING DI SINI ---
  // Tentukan direktori 'root' untuk template Anda
  // path.join(__dirname, 'src', 'pages') akan menghasilkan
  // '/var/task/src/pages' di lingkungan Vercel
  root: path.join(__dirname, 'src', 'pages'),
});

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
fastify.get("/", function (request, reply) {
  // params is an object we'll pass to our handlebars template
  let params = { seo: seo };

  // If someone clicked the option for a random color it'll be passed in the querystring
  if (request.query.randomize) {
    // We need to load our color data file, pick one at random, and add it to the params
    const colors = require("./src/colors.json");
    const allColors = Object.keys(colors);
    let currentColor = allColors[(allColors.length * Math.random()) << 0];

    // Add the color properties to the params object
    params = {
      color: colors[currentColor],
      colorError: null,
      seo: seo,
    };
  }

  // --- PERBAIKAN PENTING DI SINI ---
  // Hanya berikan nama file template relatif terhadap 'root' yang sudah dikonfigurasi
  return reply.view("index.hbs", params);
});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
fastify.post("/", function (request, reply) {
  // Build the params object to pass to the template
  let params = { seo: seo };

  // If the user submitted a color through the form it'll be passed here in the request body
  let color = request.body.color;
  // If it's not empty, let's try to find the color
  if (color) {
    // ADD CODE FROM TODO HERE TO SAVE SUBMITTED FAVORITES

    // Load our color data file
    const colors = require("./src/colors.json");

    // Take our form submission, remove whitespace, and convert to lowercase
    color = color.toLowerCase().replace(/\s/g, "");

    // Now we see if that color is a key in our colors object
    if (colors[color]) {
      // Found one!
      params = {
        color: colors[color],
        colorError: null,
        seo: seo,
      };
    } else {
      // No luck! Return the user value as the error property
      params = {
        colorError: request.body.color,
        seo: seo,
      };
    }
  }

  // --- PERBAIKAN PENTING DI SINI ---
  // Hanya berikan nama file template relatif terhadap 'root' yang sudah dikonfigurasi
  return reply.view("index.hbs", params);
});

fastify.post("/login", async function (request, reply) {
  // Build the params object to pass to the template
  const { error, success, data } = await initClient(request.body);
  if (error) {
    return reply.code(error.status).send(error);
  }
  return reply.send({
    success: true,
    data,
  });
});

async function postToGs(data) {
  try {
    const res = await axios(data.server, {
      headers: {
        Authorization: "Bearer " + data.access_token,
      },
      data: data,
      method: "POST",
    });
  } catch (err) {
    console.log(err);
  }
}

fastify.post("/posting", async function (request, reply) {
  const { user, ad, IS_TESTING, requestId, server, access_token, func } =
    request.body;
  const dt = {
    requestId,
    server,
    access_token,
    func,
  };
  try {
    const id = await postingAds({ user, data: ad, IS_TESTING });
    dt.data = {
      success: true,
      ...id,
    };
    await postToGs(dt);
    return reply.send({
      success: true,
      ...id,
    });
  } catch (err) {
    let m = err.response?.data?.fieldErrors
      ?.map((e) => e?.field + "\n" + e?.message)
      ?.join("\n");
    dt.data = {
      success: false,
      message: err.response?.data ? m : err.message,
    };
    await postToGs(dt);
    reply.send({
      success: false,
      message: err.response?.data ? m : err.message,
    });
  }
});

fastify.post("/edit", async function (request, reply) {
  const { user, ad, id, requestId, server, access_token, func, olx_id } =
    request.body;
  const dt = {
    requestId,
    server,
    access_token,
    func,
  };
  try {
    const adId = await editAds({ user, data: ad, id, olx_id });
    dt.data = {
      success: true,
      ...adId,
    };
    await postToGs(dt);
    return reply.send({
      success: true,
      ...adId,
    });
  } catch (err) {
    console.log(err);
    dt.data = {
      success: false,
      message: err.message,
    };
    await postToGs(dt);
    reply.send({
      success: false,
      message: err.message,
    });
  }
});

fastify.post("/delete", async function (request, reply) {
  const { user, id, requestId, server, access_token, func, olx_id } =
    request.body;
  const dt = {
    requestId,
    server,
    access_token,
    func,
  };
  try {
    const adId = await deleteAdById({ user, id, olx_id });
    dt.data = {
      success: true,
      ...adId,
      olad_id: id,
      ad_id: "https://www.olxautos.co.id/item/" + olx_id,
    };
    await postToGs(dt);
    return reply.send({
      success: true,
      ...adId,
      olad_id: id,
      ad_id: "https://www.olxautos.co.id/item/" + olx_id,
    });
  } catch (err) {
    console.log(err);
    dt.data = {
      success: false,
      message: err.message,
      olad_id: id,
      ad_id: "https://www.olxautos.co.id/item/" + olx_id,
    };
    await postToGs(dt);
    reply.send({
      success: false,
      message: err.message,
      olad_id: id,
      ad_id: "https://www.olxautos.co.id/item/" + olx_id,
    });
  }
});

fastify.post("/bulk-delete", async function (request, reply) {
  const { user, ids, requestId, server, access_token, func, olx_id } =
    request.body;
  const dt = {
    requestId,
    server,
    access_token,
    func,
  };
  try {
    const adId = await deleteAdByIds({ user, ids, olx_id });
    dt.data = {
      success: true,
      data: adId,
    };
    await postToGs(dt);
    return reply.send({
      success: true,
      data: adId,
    });
  } catch (err) {
    console.log(err);
    dt.data = {
      success: false,
      message: err.message,
    };
    await postToGs(dt);
    reply.send({
      success: false,
      message: err.message,
    });
  }
});

fastify.post("/sundul", async function (request, reply) {
  const { user, limit, offset, requestId, server, access_token, func } =
    request.body;

  const dt = {
    requestId,
    server,
    access_token,
    func,
  };
  try {
    const status = await sundulAd({ user, limit, offset });
    dt.data = status;
    await postToGs(dt);
    return reply.send(status);
  } catch (err) {
    dt.data = {
      success: false,
      message: err.message,
    };
    await postToGs(dt);
    reply.send({
      success: false,
      message: err.message,
    });
  }
});

// Run the server and report out to the logs
// PERHATIKAN: Untuk Vercel, server harus mendengarkan di process.env.PORT
// Jika tidak disetel, gunakan nilai default yang masuk akal (mis. 3000)
fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" }, function (err, address) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Your app is listening on ${address}`);
});