const adsParameter = require("./adsParams.json");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

class Olx {
  constructor(
    email,
    password,
    headers = {
      "api-version": "133",
      "client-language": "en-id",
    }
  ) {
    this.headers = headers;
    this.email = email;
    this.password = password;
    this.locations = [];
  }
  getUser() {
    try {
      const file = this.email + ".json";
      const token = fs.readFileSync(file, "utf-8");
      const user = JSON.parse(token);
      this.user = user;
      console.log(user);
      return user;
    } catch (error) {
      return;
    }
  }
  async auth(force) {
    if (this.getUser() && !force) {
      return;
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
      const file = this.email + ".json";
      fs.writeFileSync(file, JSON.stringify(data));
      console.log("login success");
      return data;
    } catch (error) {
      console.log(error);
      return;
    }
  }
  async refreshToken() {
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
    console.log(data);
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
      console.log(data);
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
    return data.data;
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
  async getAllAds(limit = 1000) {
    const url =
      "https://dealer.olx.co.id/dealer-api/sell/my_ads?offset=0&segment=ads-live&video=true&screen=ads-live&count=" +
      limit +
      "&sort=creationDate,desc";
    const { data } = await axios(url, {
      headers: {
        ...this.headers,
        Authorization: "Bearer " + this.user.access_token,
      },
    });
    console.log(data);
  }

  async editAdById(id) {
    fetch(
      "https://dealer.olx.co.id/dealer-api/sell/posting/edit?adId=1376069",
      {
        headers: {
          accept: "*/*",
          "accept-language":
            "en-GB,en;q=0.9,id-ID;q=0.8,id;q=0.7,ko-KR;q=0.6,ko;q=0.5,ja-JP;q=0.4,ja;q=0.3,en-US;q=0.2",
          "api-version": "133",
          authorization:
            "Bearer eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6ImViT21QTmlrIn0.eyJncmFudFR5cGUiOiJlbWFpbCIsImNsaWVudFR5cGUiOiJ3ZWIiLCJ0b2tlblR5cGUiOiJhY2Nlc3NUb2tlbiIsImlzTmV3VXNlciI6ZmFsc2UsImlhdCI6MTczNjA1NTcwMywiZXhwIjoxNzM2MDU2NjAzLCJhdWQiOiJvbHhpZCIsImlzcyI6Im9seCIsInN1YiI6IjEyMzE0MDQwNiIsImp0aSI6IjhmMTAyZDRlNTRlZGU1ODZmNzUyZmU0YmNlYmFlNzhkYjU0ZWU0MTkifQ.ncyx4uChhfgsVR5NBSrV5BYY7eugblGO_jcBj8J5oYUhPK3W_xA9EKaYn4a97rVWdXm28x8sIuMNzd9fmlvGdiFPThASrxAGnmXtyrKTtaNXTvjefbe8pHy3DgeG8jbZnMG7IeWmTd-nuUZ53a-kKcH_4EOfsXxVHqZFVf5kg3i6KNcunJ-qPsevy4vurj5yZYCegznldNgyjIhJnnVTUrOOTXJ6_prr0-cx_1ZdEGMuQSBrZEsBXMIJdXHAk5j1bA3S5i0Fw-EbO7XeQNTRsR1TwLFyfSd4_V3dKOWJHbe5JmmNU2fe-troa9BMyerNFkZQZlMRiDqFqN_3Oj-QSg",
          "client-language": "en-id",
          "client-platform": "web",
          "client-version": "3.6",
          "config-version": "dca8054bac5aa1edf4ed48373409533a",
          "content-type": "text/plain;charset=UTF-8",
          priority: "u=1, i",
          "request-id": "2db660a2-f952-4a92-9571-27668db5e543",
          "sec-ch-ua":
            '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
        },
        referrer: "https://dealer.olx.co.id/sell/ads/ads-live",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: {
          category_id: "198",
          parameter: {
            is_video_generation_enabled: true,
            images: [
              "6778af0324ad9-ID",
              "6778aefb260be-ID",
              "6778aefc3c916-ID",
              "6778af039f10c-ID",
              "6778af030a0d9-ID",
              "6778af0433171-ID",
              "6778af04943c0-ID",
              "6778af0575c9b-ID",
              "6778af055656d-ID",
              "6778af057a0b8-ID",
              "6778af059089c-ID",
              "6778af0608cde-ID",
              "6778af06383b2-ID",
              "6778af07e6d40-ID",
              "6778af0717308-ID",
              "6778af076df07-ID",
              "6778af07ec17e-ID",
            ],
            video: {
              preview_video_url: "",
              video_url: "",
              feature_list: ["Air Conditioning (AC)", "Power Steering"],
              status: "NOT_GENERATED_YET",
            },
            make: "mobil-bekas-daihatsu",
            m_tipe: "mobil-bekas-daihatsu-rocky",
            m_tipe_variant: "mobil-bekas-daihatsu-rocky-1.2-r-bensin-at",
            m_year: "2021",
            mileage: "65",
            m_fuel: "bensin",
            m_color: "merah",
            m_engine_capacity: "1000-to-1500",
            title:
              "DP Rendah - Daihatsu Rocky 1.2 R Bensin-AT 2021 Merah (FFX)",
            price: 163000000,
            description:
              '"1364192\n\nTERMURAH\n\nDP Rendah - Daihatsu Rocky 1.2 R Bensin-AT 2021 Merah \n.\nHarga Cash : Rp.173,000,000 ,- \nHarga Credit : Rp. 163,000,000 ,-\nTDP : 13,000,000\nAngsuran 4 Tahun : Rp.5,300,000 ,-\nAngsuran 5 Tahun silahkan hubungi untuk informasi lebih lanjut\n.\nBeli Mobil Terus Untung!!\nBeli mobil dan dapatkan bonus saldo digital hingga Rp1.500.000!\n*S&K berlaku\n.\nKeunggulan Unit\n1. Pajak : November 2024 \n2. Odometer : 61.xxx \n3. Like New\n4. Tangan Pertama\n5. Atas nama  : Perorangan\n6. Plat Ganjil\n.\nKeunggulan Model :\n- Interior kulit asli\n- Astra Certified\n.\nAS IT IS - Mengapa Anda harus membeli mobil di OLXmobbi? \n1. Gratis Biaya Jasa Perawatan\n2. Jaminan 7 hari jaminan uang kembali \n3. Test Drive dari Rumah, \n4. Ada 2.000+ pilihan mobil bekas Mobil Bekas Berkualitas\n*S&K berlaku\n.\nPembayaran Booking Fee / Pelunasan hanya melalui no rekening 2061/888/995 - BCA - an SERASI MITRA MOBIL PT\n\nTDP promo hanya Berlaku jika:\n- BI checking Bersih (tidak pernah ada keterlambatan pembayaran)\n- Rumah Milik Pribadi\n- Pemasukan/Gaji= 3x Angsuran.\n*Bisa di bantu Rumah Kontrak dan BI checking bermasalah dengan TDP 30%* (S&K Berlaku)\n.\nKunjungi kami di\nOLXmobbi Bekasi\nJl. Jend. Sudirman No.1, Kranji, Kec. Bekasi Bar., Kota Bks, Jawa Barat 17143\n.\nSales Advisor\nOLXmobbi\nAhlinya Mobil Bekas Berkualitas"',
            m_seller_type: "seller-type-diler",
            discounted_price: 163000000,
            has_promotion: false,
            discount_amount: "0",
            escrow_token_amount: 1000000,
            escrow_offering_id: 2031870,
            location: [
              {
                lat: -6.310924,
                lon: 106.929955,
                cityId: 4000020,
                localityId: 5001305,
                city_name: "Pondok Melati, Bekasi Kota",
              },
              {
                lat: -6.3193374,
                lon: 107.136635,
                cityId: 4000003,
                localityId: 5000777,
                city_name: "Cikarang Selatan, Bekasi Kab.",
              },
              {
                lat: -6.4279175,
                lon: 106.80014,
                cityId: 4000024,
                localityId: 5001326,
                city_name: "Cipayung, Depok Kota",
              },
              {
                lat: -6.5708375,
                lon: 106.82374,
                cityId: 4000021,
                localityId: 5001311,
                city_name: "Bogor Utara - Kota, Bogor Kota",
              },
              {
                lat: -6.575281,
                lon: 106.69398,
                cityId: 4000004,
                localityId: 5000797,
                city_name: "Ciampea, Bogor Kab.",
              },
              {
                lat: -6.183459,
                lon: 106.76475,
                cityId: 4000028,
                localityId: 5000469,
                city_name: "Kebon Jeruk, Jakarta Barat",
              },
              {
                lat: -6.128631,
                lon: 106.80309,
                cityId: 4000032,
                localityId: 5000506,
                city_name: "Penjaringan, Jakarta Utara",
              },
              {
                lat: -6.1531935,
                lon: 106.83259,
                cityId: 4000029,
                localityId: 5000479,
                city_name: "Sawah Besar, Jakarta Pusat",
              },
              {
                lat: -6.243622,
                lon: 106.80014,
                cityId: 4000030,
                localityId: 5000484,
                city_name: "Kebayoran Baru, Jakarta Selatan",
              },
              {
                lat: -6.282586,
                lon: 106.85914,
                cityId: 4000031,
                localityId: 5000497,
                city_name: "Kramat Jati, Jakarta Timur",
              },
              {
                lat: -6.1701794,
                lon: 106.64032,
                cityId: 4000079,
                localityId: 5000252,
                city_name: "Tangerang, Tangerang Kota",
              },
              {
                lat: -6.3853364,
                lon: 106.847336,
                cityId: 4000024,
                localityId: 5001330,
                city_name: "Sukmajaya, Depok Kota",
              },
              {
                lat: -6.3562055,
                lon: 107.25482,
                cityId: 4000499,
                localityId: 5001029,
                city_name: "Telukjambe Barat, Karawang Kab.",
              },
              {
                lat: -6.1826706,
                lon: 106.86799,
                cityId: 4000029,
                localityId: 5000474,
                city_name: "Cempaka Putih, Jakarta Pusat",
              },
              {
                lat: -6.123655,
                lon: 107.036224,
                cityId: 4000003,
                localityId: 5000770,
                city_name: "Babelan, Bekasi Kab.",
              },
              {
                lat: -6.409962,
                lon: 106.87684,
                cityId: 4000024,
                localityId: 5001331,
                city_name: "Tapos, Depok Kota",
              },
              {
                lat: -6.6428213,
                lon: 106.82374,
                cityId: 4000021,
                localityId: 5001308,
                city_name: "Bogor Selatan - Kota, Bogor Kota",
              },
              {
                lat: -6.4288645,
                lon: 106.92406,
                cityId: 4000004,
                localityId: 5000810,
                city_name: "Gunung Putri, Bogor Kab.",
              },
              {
                lat: -6.1342936,
                lon: 106.70577,
                cityId: 4000028,
                localityId: 5000468,
                city_name: "Kalideres, Jakarta Barat",
              },
              {
                lat: -6.1713424,
                lon: 106.82374,
                cityId: 4000029,
                localityId: 5000475,
                city_name: "Gambir, Jakarta Pusat",
              },
              {
                lat: -6.326164,
                lon: 106.856186,
                cityId: 4000031,
                localityId: 5000500,
                city_name: "Pasar Rebo, Jakarta Timur",
              },
              {
                lat: -6.308865,
                lon: 106.68219,
                cityId: 4000080,
                localityId: 5000257,
                city_name: "Serpong, Tangerang Selatan Kota",
              },
              {
                lat: -6.1997366,
                lon: 106.57609,
                cityId: 4000079,
                localityId: 5000245,
                city_name: "Jatiuwung, Tangerang Kota",
              },
              {
                lat: -5.998603,
                lon: 106.311066,
                cityId: 4000075,
                localityId: 5000194,
                city_name: "Tirtayasa, Serang Kab.",
              },
              {
                lat: -6.3889127,
                lon: 107.49135,
                cityId: 4000499,
                localityId: 5001017,
                city_name: "Kotabaru, Karawang Kab.",
              },
            ],
          },
        },
        method: "POST",
        mode: "cors",
        credentials: "include",
      }
    );
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
    const idIklan = res.data.data[0].id;
    return idIklan;
  }

  /** create ads */
  findData(key, val) {
    const merek = key.name.toString().toLowerCase();
    const m = val?.toString().toLowerCase();
    return merek === m || merek.includes(m) || m.includes(merek);
  }

  async createAd(data) {
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
    };

    const adsParam = adsParameter.adsParameter;
    const make = adsParam
      .find((c) => c.code === "make")
      .values.find((c) => this.findData(c, data.make));
    parameter.make = make.code;
    const model = make.children[0].values.find((c) =>
      this.findData(c, data.m_tipe)
    );
    parameter.m_tipe = model.code;
    const varian = model.children[0].values.find((c) =>
      this.findData(c, data.m_tipe_variant)
    );
    parameter.m_tipe_variant = varian.code;

    const year = adsParam
      .find((c) => c.code === "m_year")
      .values.find((c) => this.findData(c, data.m_year));
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
    parameter.mileage = mileage.code;
    const v = data.m_tipe_variant?.toString().toLowerCase();
    const bahanBakar = ["bensin", "diesel", "hybrid", "listrik"].find(
      (b) => v?.includes(b) || b === "bensin"
    ); // solar = diesel
    const fuel = adsParam
      .find((c) => c.code === "m_fuel")
      .values.find((c) => this.findData(c, data.m_fuel || bahanBakar));
    parameter.m_fuel = fuel.code;
    const color = adsParam
      .find((c) => c.code === "m_color")
      .values.find((c) => this.findData(c, data.m_color));
    parameter.m_color = color.code;
    parameter.title = data.title;
    parameter.description = data.description;
    parameter.price = +data.price;
    if (data.files) {
      const images = (
        await Promise.all(data.files.map((file) => this.uploadPicture(file)))
      )
        .filter((f) => f)
        .map((f) => f?.id);
      parameter.images = images;
    }
    const location = (
      await Promise.all(
        data.location.split("\n").map((address) => this.getLocation(address))
      )
    ).filter((f) => f);
    this.saveLocation(location);
    parameter.location = location;
    console.log(parameter);
    return parameter;
  }
  async getFileByUrl({ fileUrl, fileToken }) {
    try {
      const res = await axios.get(fileUrl, {
        headers: {
          Authorization: "Bearer " + fileToken,
        },
        responseType: "arraybuffer",
      });
      return res.data;
    } catch (err) {
      return;
    }
  }
  async uploadPicture(dataFile) {
    const file = await this.getFileByUrl(dataFile);
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
    console.log(dataFile);
    return dataFile;
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
