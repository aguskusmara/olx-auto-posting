const adsParameter = require("./adsParams.json"); // Asumsikan file ini ada
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");

class Olx {
  constructor(email, password, headers) {
    if (headers) {
      this.headers = headers;
    } else {
      this.headers = {
        "api-version": "133",
        "client-language": "en-id",
      };
    }
    this.email = email;
    this.password = password;
    this.locations = [];
  }
  getUser() {
    try {
      const folder = fs.existsSync(path.join("users"));
      if (!folder) {
        fs.mkdirSync(path.join("users"));
      }
      const file = path.join("users", this.email + ".json");
      // Perhatikan: fs.readFileSync dapat melempar error jika file tidak ada,
      // pastikan penanganan error atau file selalu ada sebelum dibaca
      const token = fs.readFileSync(file, "utf-8");
      const user = JSON.parse(token);
      this.user = user;
      return user;
    } catch (error) {
      // console.error("Error reading user file:", error.message); // Tambahkan log untuk debugging
      return;
    }
  }
  async auth(force) {
    // Abaikan bagian ini jika Anda ingin selalu login, atau perbaiki logika refresh token
    // if (this.getUser() && !force) {
    //   // await this.refreshToken();
    //   // return;
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
      const file = path.join("users", this.email + ".json");
      // Pastikan direktori 'users' ada sebelum menulis file
      if (!fs.existsSync(path.dirname(file))) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
      }
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
      const file = path.join("users", this.email + ".json");
      if (!fs.existsSync(path.dirname(file))) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
      }
      fs.writeFileSync(file, JSON.stringify(data));
    } catch (err) {
      console.error("Error refreshing token:", err.message); // Tambahkan log
      // Handle error refresh token, mungkin perlu otentikasi ulang
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
      const { data } = await axios(url, {
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
      ] = data.metadata;

      return default_value;
    } catch (err) {
      console.error("Error getting OLAD by ID:", err.message, "status:", err.response?.status);
      return; // Mengembalikan undefined jika ada error
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
        old_ad.details.ad_url = "https://www.olxautos.co.id/item/" + ad_id;
      }
    }
    while (!ok) {
      await this.delay(1000);
      let { ads: ads2 } = await this.getAllAds(10);
      old_ad = ads2.find((a) => a.id === olad_id);
      console.log("wait ad show");
      ok = true;
      if (!ad_url) {
        if (!ad_id) {
          ok = false;
        } else {
          old_ad.details.ad_url = "https://www.olxautos.co.id/item/" + ad_id;
        }
      }
    }
    return old_ad;
  }
  async waitAdShowEdit(olad_id) {
    const limit = 100;
    let offset = 0;
    let { ads } = await this.getAllAds(limit, offset);
    let old_ad = ads.find((a) => a.id === olad_id);
    while (!old_ad && offset < 5000) { // Tambahkan batasan offset untuk menghindari loop tak terbatas
      await this.delay(200);
      offset += limit;
      let { ads: ads2 } = await this.getAllAds(limit, offset);
      old_ad = ads2.find((a) => a.id === olad_id);
      console.log("wait ad show edit");
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
        feature_list: ["Air Conditioning (AC)", "Power Steering"],
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

    const adsParam = adsParameter; // Pastikan adsParams.json ada dan sesuai
    const make = adsParam
      .find((c) => c.code === "make")
      .values.find((c) => this.findData(c, data.make));
    if (!make) {
      throw new Error(data.make + " tidak di temukan");
    }
    parameter.make = make.code;
    const model = make.children[0].values.find((c) =>
      this.findData(c, data.m_tipe)
    );
    if (!model) {
      throw new Error(data.m_tipe + " tidak di temukan");
    }
    parameter.m_tipe = model.code;
    const varian = model.children[0].values.find((c) =>
      this.findData(c, data.m_tipe_variant)
    );
    if (!varian) {
      console.log(model.children[0].values);
      throw new Error(data.m_tipe_variant + " tidak di temukan");
    }
    parameter.m_tipe_variant = varian.code;

    const year = adsParam
      .find((c) => c.code === "m_year")
      .values.find((c) => this.findData(c, data.m_year));
    if (!year) {
      throw new Error(data.m_year + " tidak di temukan");
    }
    parameter.m_year = year.code;
    const mileage = adsParam
      .find((c) => c.code === "mileage")
      .values.find((c) => {
        let [start, end] = c.name.split("-");
        start = parseFloat(start) * 1000 || start;
        end = parseFloat(end) * 1000 || start;
        return (
          (+data.mileage > start && +data.mileage < end) ||
          start.toString().includes(">")
        );
      });
    if (!mileage) {
      throw new Error(data.mileage + " tidak di temukan");
    }

    parameter.mileage = mileage.code;
    const v = data.m_tipe_variant?.toString().toLowerCase();
    const bahanBakar = ["bensin", "diesel", "hybrid", "listrik"].find(
      (b) =>
        (v === "solar" && b === "diesel") || v?.includes(b) || b === "bensin"
    ); // solar = diesel
    const fuel = adsParam
      .find((c) => c.code === "m_fuel")
      .values.find((c) => this.findData(c, data.m_fuel || bahanBakar));
    if (!fuel) {
      throw new Error((data.m_fuel || bahanBakar) + " tidak di temukan");
    }
    parameter.m_fuel = fuel.code;
    const color = adsParam
      .find((c) => c.code === "m_color")
      .values.find((c) => this.findData(c, data.m_color));
    if (!color) {
      throw new Error(data.m_color + " tidak di temukan");
    }
    parameter.m_color = color.code;
    parameter.title = data.title;
    parameter.description = data.description;
    parameter.price = +data.price;
    if (data.files && !IS_TESTING) {
      const images = (
          // Tangani error individual upload gambar
          await Promise.all(data.files.map(async (file) => {
              try {
                  return await this.uploadPicture(file);
              } catch (uploadErr) {
                  console.error(`Failed to upload picture ${file.fileName}:`, uploadErr.message);
                  return null; // Kembalikan null agar bisa difilter
              }
          }))
      )
        .filter((f) => f) // Filter yang null
        .map((f) => f?.id);
      parameter.images = images;
    }
    const location = (
        // Tangani error individual mendapatkan lokasi
        await Promise.all(
          data.location.map(async (address) => {
              try {
                  return await this.getLocation(address);
              } catch (locErr) {
                  console.error(`Failed to get location for ${address}:`, locErr.message);
                  return null; // Kembalikan null agar bisa difilter
              }
          })
        )
    ).filter((f) => f); // Filter yang null
    this.saveLocation(location);
    parameter.location = location;
    parameter.inventory_management_id = data.inventory_management_id;
    return parameter;
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
      // console.log(file, dataFile); // Bisa dihapus setelah debugging
      throw err; // Lempar kembali error agar bisa ditangkap oleh pemanggil
    }
  }

  async getLocation(address) {
    try {
      const location = this.locations.find((l) => l.city_name === address);
      if (location) {
        console.log("local location");
        return location;
      }
      const url =
        "https://dealer.olx.co.id/dealer-api/sell/locations/autocomplete?input=" +
        encodeURIComponent(address);
      const { data: responseDataFromApi } = await axios(url, { // Rename 'data' to 'responseDataFromApi' to avoid confusion
        headers: {
          Authorization: "Bearer " + this.user.access_token,
          ...this.headers,
        },
      });
      // 'responseDataFromApi' sekarang adalah payload data dari respons API
      const { data, error } = responseDataFromApi; // Ini asumsinya API response memiliki { data, error } di dalam payload utama
      
      if (error) {
        console.error("OLX API returned an error for getLocation:", error);
        return;
      }
      
      // Tambahkan pengecekan untuk memastikan data.suggestions ada dan tidak kosong
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
      console.error("Error in getLocation:", err.message, "status:", err.response?.status); // Log error lengkap
      throw err; // Lempar kembali error
    }
  }

  saveLocation(location) {
    this.locations = [...new Set([...this.locations, ...location])];
    // Pastikan direktori root ada jika Anda mencoba menulis di sana
    // Atau simpan di direktori yang dijamin ada, misalnya '/tmp' di Vercel
    try {
        fs.writeFileSync("locations.json", JSON.stringify(this.locations));
    } catch (err) {
        console.error("Error saving locations.json:", err.message);
        // Pertimbangkan apakah ini error fatal atau bisa diabaikan
    }
  }

  getLocalLocation() {
    try {
      const location = fs.readFileSync("locations.json");
      this.locations = JSON.parse(location);
    } catch (err) {
      // console.error("Error reading locations.json:", err.message); // Tambahkan log
      return [];
    }
  }
}

module.exports = Olx;