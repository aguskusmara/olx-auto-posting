const adsParameter = require("./adsParams.json"); // Asumsikan file ini ada
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");

class Olx {
  constructor(email, password, headers) {
    console.log(email);
    if (headers) {
      this.headers = headers;
    } else {
      this.headers = {
        "api-version": "135",
        "client-language": "en-id",
        "config-version": "600ef8adcf23de5961e8816a92150b7f"
      };
    }
    this.email = email;
    this.password = password;
    this.locations = [];

    // Tentukan path dasar untuk menyimpan data pengguna di dalam /tmp
    // Pastikan direktori ini dibuat jika belum ada.
    // Ini harus dilakukan di constructor atau di awal fungsi yang membutuhkannya.
    this.userStorePath = path.join("/tmp", "users");
    // Inisialisasi lokasi dari file jika ada
    this.getLocalLocation();
  }

  // Helper untuk memastikan direktori /tmp/users ada
  ensureUserStoreDir() {
    if (!fs.existsSync(this.userStorePath)) {
      try {
        fs.mkdirSync(this.userStorePath, { recursive: true });
      } catch (e) {
        console.error("Failed to create user store directory in /tmp:", e);
        // Terus berjalan meskipun gagal membuat direktori, mungkin error akan muncul saat menulis
      }
    }
  }

  getUser() {
    try {
      this.ensureUserStoreDir(); // Pastikan direktori ada sebelum mencoba membaca
      const file = path.join(this.userStorePath, this.email + ".json");
      if (!fs.existsSync(file)) { // Cek apakah file ada sebelum membaca
        return;
      }
      const token = fs.readFileSync(file, "utf-8");
      const user = JSON.parse(token);
      this.user = user;
      return user;
    } catch (error) {
      console.error("Error reading user file from /tmp:", error.message);
      return;
    }
  }

  async auth(force) {
    // Abaikan bagian ini jika Anda ingin selalu login, atau perbaiki logika refresh token
    // if (this.getUser() && !force) {
    //   // await this.refreshToken();
    //   // return;
    // }
    console.log("login ke dealer apps");
    const url = "https://dealer.olx.co.id/dealer-api/v1/auth/login";
    try {
      const { data } = await axios(url, {
        headers: {
          ...this.headers,
        },
        data: {
          password: this.password,
          login: this.email,
        },
        method: "POST",
      });
      this.user = data;

      // Pastikan direktori /tmp/users ada sebelum menulis file
      this.ensureUserStoreDir();
      const file = path.join(this.userStorePath, this.email + ".json");
      fs.writeFileSync(file, JSON.stringify(data));
      console.log("login success");
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("Authentication error details:", error); // Log error lengkap untuk debugging
      let errorMessage = "Unknown authentication error";
      let errorStatus = 500; // Default ke Internal Server Error

      if (error.response) {
        // Jika ada respons dari server (misalnya 401, 403)
        // Gunakan optional chaining untuk mengakses 'data' dan 'error'
        errorMessage = error.response.data?.error || error.response.statusText || errorMessage;
        errorStatus = error.response.status || errorStatus;
      } else if (error.request) {
        // Permintaan dibuat tapi tidak ada respons diterima (mis. masalah jaringan)
        errorMessage = "Network error or no response from server.";
        errorStatus = 503; // Service Unavailable
      } else {
        // Sesuatu terjadi dalam pengaturan permintaan yang memicu Error
        errorMessage = error.message;
      }

      return {
        error: {
          error: errorMessage,
          status: errorStatus,
        },
      };
    }
  }

  async refreshToken() {
    if (!this.user) {
      this.getUser();
    }
    // Jika masih tidak ada user setelah getUser, berarti tidak bisa refresh
    if (!this.user || !this.user.refresh_token) {
      console.error("No user or refresh token available to refresh.");
      throw new Error("No user or refresh token to refresh.");
    }

    const url = "https://dealer.olx.co.id/dealer-api/v1/auth/refresh_token";
    try {
      const { data } = await axios(url, {
        headers: {
          Authorization: "Bearer " + this.user.refresh_token,
          ...this.headers,
        },
        method: "POST",
        data: {
          user_id: this.user.user_id,
        },
      });
      this.user = data;

      // Pastikan direktori /tmp/users ada sebelum menulis file
      this.ensureUserStoreDir();
      const file = path.join(this.userStorePath, this.email + ".json");
      fs.writeFileSync(file, JSON.stringify(data));
    } catch (err) {
      console.error("Error refreshing token:", err.message); // Tambahkan log
      throw err; // Lempar kembali error agar bisa ditangani di tempat lain
    }
  }

  async getMe() {
    const url = "https://dealer.olx.co.id/dealer-api/v1/auth/me";
    try {
      const { data } = await axios(url, {
        headers: {
          Authorization: "Bearer " + this.user.access_token,
          ...this.headers,
        },
      });
      return data;
    } catch (err) {
      console.error("Error getMe:", err.message, "status:", err.response?.status); // Log status jika ada
      if (err.response && err.response.status === 403) {
        await this.auth(true);
        return await this.getMe();
      }
      throw err; // Lempar kembali error jika bukan 403 atau gagal auth ulang
    }
  }

  async getQuota() {
    const url =
      "https://dealer.olx.co.id/dealer-api/sell/user_packages?categoryId=198&cityId=4000029&code=CODE_VAS";
    try {
      const { data } = await axios(url, {
        headers: {
          ...this.headers,
          Authorization: "Bearer " + this.user.access_token,
        },
      });
      const paket = data.data?.map((d) => {
        return {
          package_id: d?.package_id,
          quota: +d?.package_info?.available?.replace(/[^0-9]/g, ""),
        };
      });
      return paket;
    } catch (err) {
      console.error("Error fetching quota:", err.message, "status:", err.response?.status);
      throw err;
    }
  }

  async sundulAdsByid(inventory_id, package_id) {
    const url = "https://dealer.olx.co.id/dealer-api/sell/consumefeature";
    try {
      const { data } = await axios(url, {
        headers: {
          ...this.headers,
          Authorization: "Bearer " + this.user.access_token,
        },
        data: {
          inventory_id: inventory_id,
          package_id: package_id,
          feature_code: "CODE_BOOSTTOTOP",
        },
        method: "POST",
      });
      return data.data.message;
    } catch (err) {
      console.error("Error sunduling ad:", err.message, "status:", err.response?.status);
      throw err;
    }
  }

  async getAllAds(limit = 1000, offset = 0, sundul = false) {
    let param = sundul ? "ads-live" : "ads-all";
    const url =
      "https://dealer.olx.co.id/dealer-api/sell/my_ads?offset=" +
      offset +
      "&segment=" +
      param +
      "&video=true&screen=" +
      param +
      "&count=" +
      limit +
      "&sort=creationDate,desc";
    try {
      const { data } = await axios(url, {
        headers: {
          ...this.headers,
          Authorization: "Bearer " + this.user.access_token,
        },
      });
      return data;
    } catch (err) {
      console.error("Error getting all ads:", err.message, "status:", err.response?.status);
      throw err;
    }
  }

  async getAdByid(id) {
    const url =
      "https://dealer.olx.co.id/dealer-api/sell/my_ads?offset=0&segment=ads-live&query=" +
      id +
      "&video=true&screen=ads-live&count=12&sort=creationDate,desc";
    try {
      const { data } = await axios(url, {
        headers: {
          ...this.headers,
          Authorization: "Bearer " + this.user.access_token,
        },
      });
      if (data.total === 0) {
        throw new Error("Iklan tidak ditemukan");
      }
      const [ad] = data.ads;
      console.log(ad);
      return ad; // Tambahkan return ad
    } catch (err) {
      console.error("Error getting ad by ID:", err.message, "status:", err.response?.status);
      throw err; // Penting untuk melempar error agar ditangkap oleh pemanggil
    }
  }

  async getOladByid(id) {
    try {
      const url =
        "https://dealer.olx.co.id/dealer-api/sell/posting/edit?adId=" +
        id +
        "&video=true";
      const { data: responseDataFromApi } = await axios(url, { // Rename 'data' to 'responseDataFromApi' to avoid confusion
        headers: {
          ...this.headers,
          Authorization: "Bearer " + this.user.access_token,
        },
      });
      const [
        {
          parameters: {
            inventory_management_id: { default_value },
          },
        },
      ] = responseDataFromApi.metadata; // Akses metadata dari responseDataFromApi

      return default_value;
    } catch (err) {
      console.error("Error getting OLAD by ID:", err.message, "status:", err.response?.status);
      throw err; // Lempar error untuk ditangani di tingkat yang lebih tinggi
    }
  }

  async deleteAdById(id) {
    const url =
      "https://dealer.olx.co.id/dealer-api/sell/" + id + "/delete?code=close";
    try {
      const { data } = await axios(url, {
        headers: {
          Authorization: "Bearer " + this.user.access_token,
          ...this.headers,
        },
        method: "DELETE",
      });
      return data;
    } catch (err) {
      console.error("Error deleting ad by ID:", err.message, "status:", err.response?.status);
      throw err;
    }
  }

  async editAdById(id, ad) {
    try {
      ad = await this.createAd(ad); // Memanggil createAd, pastikan ini tidak error
      const inventory_id = await this.getOladByid(id);
      if (inventory_id) {
        ad.inventory_management_id = inventory_id;
      }
      const url =
        "https://dealer.olx.co.id/dealer-api/sell/posting/edit?adId=" + id;
      const dataAd = {
        category_id: "198",
        parameter: ad,
      };
      const res = await axios(url, {
        headers: {
          Authorization: "Bearer " + this.user.access_token,
          ...this.headers,
        },
        data: dataAd,
        method: "POST",
      });
      const olad_id = res.data.data[0].id;
      /* get id iklan olx**/
      const old_ad = await this.waitAdShowEdit(olad_id);
      return { olad_id, ad_id: old_ad?.details?.ad_url, message: "done edit" };
    } catch (err) {
      console.error("Error editing ad by ID:", err.message, "status:", err.response?.status);
      throw err;
    }
  }

  async delay(ms = 500) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }

  async waitAdShow(olad_id) {
    let { ads } = await this.getAllAds(10);
    let old_ad = ads.find((a) => a.id === olad_id);
    let ad_url = old_ad?.details?.ad_url;
    let ad_id = old_ad?.details?.ad_table?.find(
      (a) => a.key === "Ad Id"
    )?.values;
    let ok = true;
    if (!ad_url) {
      if (!ad_id) {
        ok = false;
      } else {
        // Asumsi old_ad dan old_ad.details sudah didefinisikan jika ad_id ditemukan
        if (old_ad && old_ad.details) {
          old_ad.details.ad_url = "https://www.olxautos.co.id/item/" + ad_id;
        } else {
          // Handle case where old_ad or old_ad.details is undefined
          old_ad = { details: { ad_url: "https://www.olxautos.co.id/item/" + ad_id } };
        }
      }
    }
    let attempt = 0;
    const maxAttempts = 20; // Batasi percobaan untuk menghindari loop tak terbatas
    while (!ok && attempt < maxAttempts) {
      await this.delay(1000);
      let { ads: ads2 } = await this.getAllAds(10);
      old_ad = ads2.find((a) => a.id === olad_id);
      console.log("wait ad show attempt:", ++attempt);
      ok = true;
      if (!old_ad) { // Jika iklan masih belum ditemukan
        ok = false;
      } else {
        ad_url = old_ad.details?.ad_url;
        ad_id = old_ad.details?.ad_table?.find((a) => a.key === "Ad Id")?.values;
        if (!ad_url && !ad_id) {
          ok = false;
        } else if (!ad_url && ad_id) {
          old_ad.details.ad_url = "https://www.olxautos.co.id/item/" + ad_id;
        }
      }
    }
    if (!ok) {
      console.warn(`Ad ${olad_id} not found after ${maxAttempts} attempts.`);
    }
    return old_ad;
  }

  async waitAdShowEdit(olad_id) {
    const limit = 100;
    let offset = 0;
    const maxOffset = 5000; // Batasi offset untuk menghindari loop tak terbatas
    let { ads } = await this.getAllAds(limit, offset);
    let old_ad = ads.find((a) => a.id === olad_id);
    while (!old_ad && offset < maxOffset) {
      await this.delay(200);
      offset += limit;
      let { ads: ads2 } = await this.getAllAds(limit, offset);
      old_ad = ads2.find((a) => a.id === olad_id);
      console.log("wait ad show edit (offset:", offset, ")");
    }
    return old_ad; // Mengembalikan undefined jika tidak ditemukan setelah loop
  }

  async postingAd(ad) {
    const data = {
      category_id: "198",
      parameter: ad,
    };
    const url = "https://dealer.olx.co.id/dealer-api/sell/posting";
    try {
      const res = await axios(url, {
        headers: {
          Authorization: "Bearer " + this.user.access_token,
          ...this.headers,
        },
        data,
        method: "POST",
      });
      const olad_id = res.data.data[0].id;
      /* get id iklan olx**/
      const old_ad = await this.waitAdShow(olad_id);
      console.log({ olad_id, old_ad });
      return { olad_id, ad_id: old_ad?.details?.ad_url, message: "done upload" };
    } catch (err) {
      console.error("Error posting ad:", err.message, "status:", err.response?.status);
      throw err;
    }
  }

  /** create ads */
  findData(key, val) {
    if (!key || !val) return false; // Tambahkan cek null/undefined
    const merek = key.name.toString().toLowerCase();
    const m = val?.toString().toLowerCase();
    return merek === m && !key.deleted;
    // || merek.includes(m) || m.includes(merek);
  }

  async createAd(data, IS_TESTING) {
    const parameter = {
      is_video_generation_enabled: true,
      images: [],
      video: {
        preview_video_url: "",
        video_url: "",
        feature_list: [], // Ini mungkin perlu disesuaikan dengan data.feature_list
        status: "NOT_GENERATED_YET",
      },
      make: "",
      m_tipe: "",
      m_tipe_variant: "",
      m_year: "",
      mileage: "",
      m_fuel: "",
      m_color: "",
      m_engine_capacity: "1000-to-1500", //default
      title: "",
      price: 0,
      description: "",
      m_seller_type: "seller-type-diler",
      discounted_price: 0,
      has_promotion: false,
      discount_amount: "0",
      escrow_token_amount: 0,
      escrow_offering_id: 0,
      location: [],
      inventory_management_id: "",
    };

    // Tambahkan fitur dari data jika ada
    if (data.feature_list && Array.isArray(data.feature_list)) {
      parameter.video.feature_list = data.feature_list;
    } else {
      parameter.video.feature_list = ["Air Conditioning (AC)", "Power Steering"]; // Default jika tidak ada
    }

    const adsParam = adsParameter; // Pastikan adsParams.json ada dan sesuai

    // Validasi bahwa adsParam memiliki struktur yang diharapkan
    if (!Array.isArray(adsParam)) {
      throw new Error("adsParams.json is not in expected array format.");
    }

    const findParamValue = (paramCode, value) => {
      const param = adsParam.find((c) => c.code === paramCode);
      if (!param) {
        throw new Error(`Parameter code '${paramCode}' not found in adsParams.json.`);
      }
      const foundValue = param.values.find((c) => this.findData(c, value));
      if (!foundValue) {
        throw new Error(`${value} not found for ${paramCode}.`);
      }
      return foundValue;
    };

    try {
      const make = findParamValue("make", data.make);
      parameter.make = make.code;

      const model = make.children[0].values.find((c) => this.findData(c, data.m_tipe));
      if (!model) {
        throw new Error(data.m_tipe + " not found for make " + data.make);
      }
      parameter.m_tipe = model.code;

      const varian = model.children[0].values.find((c) => this.findData(c, data.m_tipe_variant));
      if (!varian) {
        console.log(model.children[0].values); // Log jika varian tidak ditemukan
        throw new Error(data.m_tipe_variant + " not found for model " + data.m_tipe);
      }
      parameter.m_tipe_variant = varian.code;

      const year = findParamValue("m_year", data.m_year);
      parameter.m_year = year.code;

      const mileage = adsParam
        .find((c) => c.code === "mileage")
        .values.find((c) => {
          let [start, end] = c.name.split("-");
          start = parseFloat(start) * 1000 || 0; // Ubah 'start' ke 0 jika tidak ada
          end = parseFloat(end) * 1000 || Infinity; // Ubah 'end' ke Infinity jika tidak ada
          // Check if the current mileage is within the range, or if the range is open-ended (e.g., ">100000")
          return (+data.mileage >= start && +data.mileage <= end) || c.name.includes(">");
        });
      if (!mileage) {
        throw new Error(data.mileage + " not found for mileage range.");
      }
      parameter.mileage = mileage.code;

      const v = data.m_tipe_variant?.toString().toLowerCase();
      const bahanBakar = ["bensin", "diesel", "hybrid", "listrik"].find(
        (b) =>
          (v === "solar" && b === "diesel") || v?.includes(b) || b === "bensin"
      ); // solar = diesel
      console.log({ bahanBakar, f: data.m_fuel, d: parameter.m_fuel, v })
      const fuel = findParamValue("m_fuel", data.m_fuel || bahanBakar);
      parameter.m_fuel = fuel.code;

      const color = findParamValue("m_color", data.m_color);
      parameter.m_color = color.code;

      parameter.title = data.title;
      parameter.description = data.description;
      parameter.price = +data.price;

      if (data.files && !IS_TESTING) {
        const images = (
          await Promise.all(data.files.map(async (file) => {
            try {
              return await this.uploadPicture(file);
            } catch (uploadErr) {
              console.error(`Failed to upload picture ${file.fileName}:`, uploadErr.message);
              return null;
            }
          }))
        )
          .filter((f) => f) // Filter yang null
          .map((f) => f?.id);
        parameter.images = images;
      }

      const location = (
        await Promise.all(
          data.location.map(async (address) => {
            try {
              return await this.getLocation(address);
            } catch (locErr) {
              console.error(`Failed to get location for ${address}:`, locErr.message);
              return null;
            }
          })
        )
      ).filter((f) => f); // Filter yang null
      this.saveLocation(location);
      parameter.location = location;
      parameter.inventory_management_id = data.inventory_management_id;
      return parameter;

    } catch (validationError) {
      console.error("Error creating ad parameter:", validationError.message);
      throw validationError; // Lempar kembali error validasi agar ditangani di tingkat atas
    }
  }

  async getFileByUrl({ fileUrl, fileToken, mime }) {
    try {
      const res = await axios.get(fileUrl, {
        headers: {
          Authorization: "Bearer " + fileToken,
          Accept: mime,
        },
        responseType: "arraybuffer",
      });
      return res.data;
    } catch (err) {
      console.error("Error fetching file by URL:", err.message); // Log error
      return;
    }
  }

  async uploadPicture(dataFile) {
    let file;
    try {
      file = await this.getFileByUrl(dataFile);
      if (!file) {
        console.warn("No file content received for upload:", dataFile.fileName);
        return; // Mengembalikan undefined jika file tidak didapatkan
      }
      const url = "https://dealer.olx.co.id/dealer-api/sell/image";
      const form = new FormData();
      form.append("file", file, dataFile.fileName);
      const { data } = await axios(url, {
        headers: {
          ...form.getHeaders(),
          Authorization: "Bearer " + this.user.access_token,
          ...this.headers,
        },
        data: form,
        method: "POST",
      });
      dataFile.id = data.data.id;
      return dataFile;
    } catch (err) {
      console.error("Error uploading picture:", err.message); // Log error
      console.log(file);
      throw err; // Lempar kembali error agar bisa ditangkap oleh pemanggil
    }
  }

  async getLocation(address) {
    try {
      const location = this.locations.find((l) => l.city_name === address);
      if (location) {
        console.log("local location found");
        return location;
      }
      const url =
        "https://dealer.olx.co.id/dealer-api/sell/locations/autocomplete?input=" +
        encodeURIComponent(address);
      const { data: responseDataFromApi } = await axios(url, {
        headers: {
          Authorization: "Bearer " + this.user.access_token,
          ...this.headers,
        },
      });
      const { data, error } = responseDataFromApi;

      if (error) {
        console.error("OLX API returned an error for getLocation:", error);
        return;
      }

      if (!data || !data.suggestions || data.suggestions.length === 0) {
        console.warn(`No suggestions found for address: ${address}`);
        return;
      }

      const [{ latitude, longitude, parentId, id, name }] = data.suggestions;
      const item = {
        lat: latitude,
        lon: longitude,
        cityId: parentId,
        localityId: id,
        city_name: name,
      };
      return item;
    } catch (err) {
      console.error("Error in getLocation:", err.message, "status:", err.response?.status);
      throw err; // Lempar kembali error
    }
  }

  saveLocation(location) {
    this.locations = [...new Set([...this.locations, ...location])];
    try {
      // Simpan di /tmp
      const locationFilePath = path.join("/tmp", "locations.json");
      fs.writeFileSync(locationFilePath, JSON.stringify(this.locations));
    } catch (err) {
      console.error("Error saving locations.json to /tmp:", err.message);
    }
  }

  getLocalLocation() {
    try {
      const locationFilePath = path.join("/tmp", "locations.json");
      if (fs.existsSync(locationFilePath)) { // Cek apakah file ada sebelum membaca
        const location = fs.readFileSync(locationFilePath, 'utf-8');
        this.locations = JSON.parse(location);
      } else {
        console.log("locations.json not found in /tmp, initializing empty.");
        this.locations = [];
      }
    } catch (err) {
      console.error("Error reading locations.json from /tmp:", err.message);
      this.locations = []; // Pastikan locations diinisialisasi kosong jika ada error
    }
  }
}

module.exports = Olx;
