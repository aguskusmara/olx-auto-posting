/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */
const axios = require("axios");

const path = require("path");
const fs = require("fs");
const {
  Olx, // Tidak digunakan langsung di sini, tapi diimpor dari clients.js
  clients, // Tidak digunakan langsung di sini, tapi diimpor dari clients.js
  initClient,
  getClient,
  deleteClient,
  postingAds,
  editAds,
  sundulAd,
  deleteAdById,
  deleteAdByIds,
} = require("./src/clients.js"); // Asumsi lokasi file clients.js

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: true,
  keepAliveTimeout: 300000,
  http2SessionTimeout: 300000,
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files (jika Anda menggunakan file statis seperti CSS/JS)
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// Konfigurasi @fastify/view untuk Handlebars
fastify.register(require('@fastify/view'), {
  engine: {
    handlebars: require('handlebars')
  },
  // Pastikan 'root' mengarah ke direktori tempat template .hbs Anda berada
  // Misalnya, jika index.hbs ada di your-project-root/src/pages/
  root: path.join(__dirname, 'src', 'pages') // Ini akan menunjuk ke /var/task/src/pages/
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

  // The Handlebars template will use the parameter values to update the page with the chosen color
  return reply.view("/src/pages/index.hbs", params);
});

// Route untuk login client
fastify.post("/login", async function (request, reply) {
  const { error, success, data } = await initClient(request.body);
  if (error) {
    return reply.status(error.status || 500).send(error); // Menambahkan status code default
  }
  return reply.send({
    success: true,
    data,
  });
});

// Fungsi helper untuk mengirim data ke Google Sheets
async function postToGs(data) {
  try {
    // Pastikan data.server dan data.access_token ada sebelum membuat request
    if (!data.server || !data.access_token) {
      fastify.log.error("postToGs: Missing server URL or access token. Cannot post to GS.", data);
      return; // Hentikan eksekusi jika parameter penting tidak ada
    }
    const res = await axios(data.server, {
      headers: {
        Authorization: "Bearer " + data.access_token,
      },
      data: data, // Mengirim objek 'data' itu sendiri sebagai body request
      method: "POST",
    });
    fastify.log.info("Successfully posted data to Google Sheets.");
    return res.data; // Mengembalikan data respons jika perlu
  } catch (err) {
    fastify.log.error("Error posting to Google Sheets:", err.message);
    if (err.response) {
      fastify.log.error("GS API Response Error Data:", err.response.data);
      fastify.log.error("GS API Response Status:", err.response.status);
    } else if (err.request) {
      fastify.log.error("GS API Request Error (no response):", err.request);
    }
    // Tidak perlu melempar error di sini, karena error sudah ditangani dan dicatat
  }
}

// Route untuk memposting iklan
fastify.post("/posting", async function (request, reply) {
  const { user, ad, IS_TESTING, requestId, server, access_token, func } =
    request.body;

  const dt = {
    requestId,
    server,
    access_token,
    func,
    car_id: ad ? ad.car_id : 'N/A', // Pastikan car_id diambil dengan aman
  };

  try {
    const id = await postingAds({ user, data: ad, IS_TESTING });

    // Data untuk dikirim ke Google Sheets jika sukses
    dt.data = {
      success: true,
      ...id,
    };
    await postToGs(dt);

    // Respon ke client
    return reply.send({
      success: true,
      message: "Ad posted successfully.",
      ...id,
      car_id: ad ? ad.car_id : undefined, // Sertakan car_id di respons client jika ada
    });

  } catch (err) {
    fastify.log.error("Error in /posting route:", err); // Log seluruh objek error untuk debugging

    let clientErrorMessage = "An unexpected error occurred."; // Pesan default untuk client
    let gsErrorMessage = "An unexpected error occurred."; // Pesan default untuk Google Sheets

    if (err.response) {
      // Error dari respons API eksternal (mis. OLX)
      const apiErrorData = err.response.data;
      if (apiErrorData && apiErrorData.fieldErrors && apiErrorData.fieldErrors.length > 0) {
        // Jika ada fieldErrors spesifik
        clientErrorMessage = apiErrorData.fieldErrors
          .map((e) => (e.field ? `${e.field}: ` : '') + e.message)
          .join("\n");
      } else if (apiErrorData && apiErrorData.message) {
        // Jika ada properti 'message' di data respons API
        clientErrorMessage = apiErrorData.message;
      } else if (err.response.statusText) {
        // Fallback ke status text HTTP
        clientErrorMessage = err.response.statusText;
      }
      gsErrorMessage = `API Error (${err.response.status || 'Unknown'}): ${clientErrorMessage}`;

    } else if (err.request) {
      // Permintaan dibuat tapi tidak ada respons (mis. masalah jaringan, timeout)
      clientErrorMessage = "Network error or no response from external API. Please try again later.";
      gsErrorMessage = clientErrorMessage;
    } else {
      // Error lain (mis. dari validasi kode lokal di olx.js/client.js)
      clientErrorMessage = err.message || "An error occurred during ad processing.";
      gsErrorMessage = clientErrorMessage;
    }

    // Data untuk dikirim ke Google Sheets jika gagal
    dt.data = {
      success: false,
      message: gsErrorMessage, // Menggunakan pesan yang lebih detail untuk GS
    };
    await postToGs(dt);

    // Respon ke client dengan status HTTP 500
    reply.status(500).send({
      success: false,
      message: clientErrorMessage, // Menggunakan pesan yang lebih user-friendly untuk client
      car_id: ad ? ad.car_id : undefined, // Sertakan kembali car_id jika relevan
    });
  }
});

// Route untuk mengedit iklan
fastify.post("/edit", async function (request, reply) {
  const { user, ad, id, requestId, server, access_token, func, olx_id } =
    request.body;
  const dt = {
    requestId,
    server,
    access_token,
    func,
    car_id: ad ? ad.car_id : 'N/A', // Tambahkan car_id ke dt
    olx_id: olx_id || 'N/A' // Tambahkan olx_id ke dt
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
    fastify.log.error("Error in /edit route:", err);

    let clientErrorMessage = "An unexpected error occurred during edit.";
    let gsErrorMessage = "An unexpected error occurred during edit.";

    if (err.response) {
      const apiErrorData = err.response.data;
      if (apiErrorData && apiErrorData.fieldErrors && apiErrorData.fieldErrors.length > 0) {
        clientErrorMessage = apiErrorData.fieldErrors
          .map((e) => (e.field ? `${e.field}: ` : '') + e.message)
          .join("\n");
      } else if (apiErrorData && apiErrorData.message) {
        clientErrorMessage = apiErrorData.message;
      } else if (err.response.statusText) {
        clientErrorMessage = err.response.statusText;
      }
      gsErrorMessage = `API Error (${err.response.status || 'Unknown'}): ${clientErrorMessage}`;

    } else if (err.request) {
      clientErrorMessage = "Network error or no response from external API during edit.";
      gsErrorMessage = clientErrorMessage;
    } else {
      clientErrorMessage = err.message || "An error occurred during edit processing.";
      gsErrorMessage = clientErrorMessage;
    }

    dt.data = {
      success: false,
      message: gsErrorMessage,
    };
    await postToGs(dt);
    reply.status(500).send({
      success: false,
      message: clientErrorMessage,
    });
  }
});

// Route untuk menghapus iklan berdasarkan ID tunggal
fastify.post("/delete", async function (request, reply) {
  const { user, id, requestId, server, access_token, func, olx_id } =
    request.body;
  const dt = {
    requestId,
    server,
    access_token,
    func,
    olad_id: id || 'N/A', // Tambahkan ID asli ke dt
    ad_id: olx_id ? "https://www.olxautos.co.id/item/" + olx_id : 'N/A', // Tambahkan URL iklan ke dt
  };
  try {
    const adStatus = await deleteAdById({ user, id, olx_id });
    dt.data = {
      success: true,
      ...adStatus, // Asumsikan adStatus berisi informasi sukses
      olad_id: id,
      ad_id: "https://www.olxautos.co.id/item/" + olx_id,
    };
    await postToGs(dt);
    return reply.send({
      success: true,
      ...adStatus,
      olad_id: id,
      ad_id: "https://www.olxautos.co.id/item/" + olx_id,
    });
  } catch (err) {
    fastify.log.error("Error in /delete route:", err);

    let clientErrorMessage = "An unexpected error occurred during delete.";
    let gsErrorMessage = "An unexpected error occurred during delete.";

    if (err.response) {
      const apiErrorData = err.response.data;
      if (apiErrorData && apiErrorData.fieldErrors && apiErrorData.fieldErrors.length > 0) {
        clientErrorMessage = apiErrorData.fieldErrors
          .map((e) => (e.field ? `${e.field}: ` : '') + e.message)
          .join("\n");
      } else if (apiErrorData && apiErrorData.message) {
        clientErrorMessage = apiErrorData.message;
      } else if (err.response.statusText) {
        clientErrorMessage = err.response.statusText;
      }
      gsErrorMessage = `API Error (${err.response.status || 'Unknown'}): ${clientErrorMessage}`;

    } else if (err.request) {
      clientErrorMessage = "Network error or no response from external API during delete.";
      gsErrorMessage = clientErrorMessage;
    } else {
      clientErrorMessage = err.message || "An error occurred during delete processing.";
      gsErrorMessage = clientErrorMessage;
    }

    dt.data = {
      success: false,
      message: gsErrorMessage,
      olad_id: id,
      ad_id: olx_id ? "https://www.olxautos.co.id/item/" + olx_id : 'N/A',
    };
    await postToGs(dt);
    reply.status(500).send({
      success: false,
      message: clientErrorMessage,
      olad_id: id,
      ad_id: olx_id ? "https://www.olxautos.co.id/item/" + olx_id : 'N/A',
    });
  }
});

// Route untuk menghapus iklan secara massal
fastify.post("/bulk-delete", async function (request, reply) {
  const { user, ids, requestId, server, access_token, func } =
    request.body; // olx_id tidak relevan di sini jika ids adalah array
  const dt = {
    requestId,
    server,
    access_token,
    func,
    deleted_ids: ids || [] // Tambahkan ID yang akan dihapus ke dt
  };
  try {
    const adStatus = await deleteAdByIds({ user, ids }); // Asumsi deleteAdByIds menerima array ids
    dt.data = {
      success: true,
      data: adStatus,
    };
    await postToGs(dt);
    return reply.send({
      success: true,
      data: adStatus,
    });
  } catch (err) {
    fastify.log.error("Error in /bulk-delete route:", err);

    let clientErrorMessage = "An unexpected error occurred during bulk delete.";
    let gsErrorMessage = "An unexpected error occurred during bulk delete.";

    if (err.response) {
      const apiErrorData = err.response.data;
      if (apiErrorData && apiErrorData.fieldErrors && apiErrorData.fieldErrors.length > 0) {
        clientErrorMessage = apiErrorData.fieldErrors
          .map((e) => (e.field ? `${e.field}: ` : '') + e.message)
          .join("\n");
      } else if (apiErrorData && apiErrorData.message) {
        clientErrorMessage = apiErrorData.message;
      } else if (err.response.statusText) {
        clientErrorMessage = err.response.statusText;
      }
      gsErrorMessage = `API Error (${err.response.status || 'Unknown'}): ${clientErrorMessage}`;

    } else if (err.request) {
      clientErrorMessage = "Network error or no response from external API during bulk delete.";
      gsErrorMessage = clientErrorMessage;
    } else {
      clientErrorMessage = err.message || "An error occurred during bulk delete processing.";
      gsErrorMessage = clientErrorMessage;
    }

    dt.data = {
      success: false,
      message: gsErrorMessage,
    };
    await postToGs(dt);
    reply.status(500).send({
      success: false,
      message: clientErrorMessage,
    });
  }
});

// Route untuk sundul iklan
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
    const status = await sundulAd({ user, limit, offset }); // Asumsikan sundulAd mengembalikan objek status
    dt.data = status; // Data untuk Google Sheets
    await postToGs(dt);
    return reply.send(status); // Respon ke client
  } catch (err) {
    fastify.log.error("Error in /sundul route:", err);

    let clientErrorMessage = "An unexpected error occurred during sundul.";
    let gsErrorMessage = "An unexpected error occurred during sundul.";

    if (err.response) {
      const apiErrorData = err.response.data;
      if (apiErrorData && apiErrorData.fieldErrors && apiErrorData.fieldErrors.length > 0) {
        clientErrorMessage = apiErrorData.fieldErrors
          .map((e) => (e.field ? `${e.field}: ` : '') + e.message)
          .join("\n");
      } else if (apiErrorData && apiErrorData.message) {
        clientErrorMessage = apiErrorData.message;
      } else if (err.response.statusText) {
        clientErrorMessage = err.response.statusText;
      }
      gsErrorMessage = `API Error (${err.response.status || 'Unknown'}): ${clientErrorMessage}`;

    } else if (err.request) {
      clientErrorMessage = "Network error or no response from external API during sundul.";
      gsErrorMessage = clientErrorMessage;
    } else {
      clientErrorMessage = err.message || "An error occurred during sundul processing.";
      gsErrorMessage = clientErrorMessage;
    }

    dt.data = {
      success: false,
      message: gsErrorMessage,
    };
    await postToGs(dt);
    reply.status(500).send({
      success: false,
      message: clientErrorMessage,
    });
  }
});

const userStorePath = path.join("/tmp", "users");

function ensureUserStoreDir(userStorePath) {
  if (!fs.existsSync(userStorePath)) {
    try {
      fs.mkdirSync(userStorePath, { recursive: true });
    } catch (e) {
      console.error("Failed to create user store directory in /tmp:", e);
    }
  }
}

function initUsers() {
  ensureUserStoreDir(userStorePath);

  // 1. MENGAMBIL SEMUA LIST FILE yang ada di folder /tmp/users
  // fs.readdirSync akan mengembalikan array nama file, misal: ['usera.json', 'userb.json']
  let allUserListFiles = [];
  try {
    allUserListFiles = fs.readdirSync(userStorePath);
  } catch (err) {
    console.error("Gagal membaca direktori /tmp:", err);
  }

  console.log({ allUserListFiles })

  // 2. Membaca data master dari GitHub (users.json di root)
  const masterFilePath = path.join(process.cwd(), 'users.json');
  try {
    const data = fs.readFileSync(masterFilePath, 'utf8');
    const masterUsers = JSON.parse(data); // Asumsi isinya array of objects: [{id: "usera"}, {id: "userb"}]

    // Ambil daftar ID user dari master file untuk perbandingan
    const masterUserIds = masterUsers.map(u => `${u.id}.json`);
    console.log({ masterUserIds })
    // 3. JIKA file di /tmp tidak ada di data users.json maka akan di DELETE
    allUserListFiles.forEach(file => {
      if (!masterUserIds.includes(file)) {
        const fileToDelete = path.join(userStorePath, file);
        fs.unlinkSync(fileToDelete);
        console.log(`Deleted obsolete file: ${file}`);
      }
    });

    console.log("Sinkronisasi /tmp selesai.");
  } catch (err) {
    console.error("Gagal sinkronisasi data:", err);
  }
}

initUsers();


// Jalankan server
const start = async () => {
  try {
    // Port untuk Vercel akan otomatis diset melalui process.env.PORT
    // Untuk lokal, Anda bisa menggunakan port 3000 atau lainnya
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error("Failed to start server:", err);
    process.exit(1);
  }
};

start();