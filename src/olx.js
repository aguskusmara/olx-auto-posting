const adsParameter = require("./adsParams.json");
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
      const token = fs.readFileSync(file, "utf-8");
      const user = JSON.parse(token);
      this.user = user;
      return user;
    } catch (error) {
      return;
    }
  }
  async auth(force) {
    if (this.getUser() && !force) {
      // await this.refreshToken();
      // return;
    }
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
      fs.writeFileSync(file, JSON.stringify(data));
      console.log("login success");
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        error: {
          error: error.response.data.error,
          status: error.status,
        },
      };
    }
  }
  async refreshToken() {
    if (!this.user) {
      this.getUser();
    }
    const url = "https://dealer.olx.co.id/dealer-api/v1/auth/refresh_token";
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
    fs.writeFileSync(file, JSON.stringify(data));
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
      console.log(err, "=>>");
      if (err.status === 403) {
        await this.auth(true);
        return await this.getMe();
      }
    }
  }

  async getQuota() {
    const url =
      "https://dealer.olx.co.id/dealer-api/sell/user_packages?categoryId=198&cityId=4000029&code=CODE_VAS";
    const { data } = await axios(url, {
      headers: {
        ...this.headers,
        Authorization: "Bearer " + this.user.access_token,
      },
    });
    // .replace(/[^0-9]/g, '')
    const paket = data.data?.map((d) => {
      return {
        package_id: d?.package_id,
        quota: +d?.package_info?.available?.replace(/[^0-9]/g, ""),
      };
    });
    return paket;
  }

  async sundulAdsByid(inventory_id, package_id) {
    const url = "https://dealer.olx.co.id/dealer-api/sell/consumefeature";
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
    const { data } = await axios(url, {
      headers: {
        ...this.headers,
        Authorization: "Bearer " + this.user.access_token,
      },
    });
    return data;
  }

  async getAdByid(id) {
    const url =
      "https://dealer.olx.co.id/dealer-api/sell/my_ads?offset=0&segment=ads-live&query=" +
      id +
      "&video=true&screen=ads-live&count=12&sort=creationDate,desc";
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
      return;
    }
  }

  async deleteAdById(id) {
    const url =
      "https://dealer.olx.co.id/dealer-api/sell/" + id + "/delete?code=close";
    const { data } = await axios(url, {
      headers: {
        Authorization: "Bearer " + this.user.access_token,
        ...this.headers,
      },
      method: "DELETE",
    });
    return data;
  }

  async editAdById(id, ad) {
    ad = await this.createAd(ad);
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
    while (!old_ad) {
      await this.delay(200);
      offset += limit;
      let { ads: ads2 } = await this.getAllAds(limit, offset);
      old_ad = ads2.find((a) => a.id === olad_id);
      console.log("wait ad show edit");
    }
    return old_ad;
  }
  async postingAd(ad) {
    const data = {
      category_id: "198",
      parameter: ad,
    };
    const url = "https://dealer.olx.co.id/dealer-api/sell/posting";
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

    const adsParam = adsParameter;
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
        await Promise.all(data.files.map((file) => this.uploadPicture(file)))
      )
        .filter((f) => f)
        .map((f) => f?.id);
      parameter.images = images;
    }
    const location = (
      await Promise.all(
        data.location.map((address) => this.getLocation(address))
      )
    ).filter((f) => f);
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
      console.log(err);
      return;
    }
  }
  async uploadPicture(dataFile) {
    let file;
    try {
      file = await this.getFileByUrl(dataFile);
      if (!file) {
        return;
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
      console.log(file, dataFile);
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
      const { data: response } = await axios(url, {
        headers: {
          Authorization: "Bearer " + this.user.access_token,
          ...this.headers,
        },
      });
      const { data, error } = response;
      if (error) {
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
      console.log(err);
      return;
    }
  }

  saveLocation(location) {
    this.locations = [...new Set([...this.locations, ...location])];

    fs.writeFileSync("locations.json", JSON.stringify(this.locations));
  }

  getLocalLocation() {
    try {
      const location = fs.readFileSync("locations.json");
      this.locations = JSON.parse(location);
    } catch (err) {
      return [];
    }
  }
}

module.exports = Olx;
