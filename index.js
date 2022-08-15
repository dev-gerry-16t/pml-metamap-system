import Rascal from "rascal";
import "dotenv/config";
import sql from "mssql";
import AWS from "aws-sdk";
import config from "./config/configQueue.js";
import isNil from "lodash/isNil.js";
import isEmpty from "lodash/isEmpty.js";
import Channel from "./subscriberExchange/subscriber.js";
import CONFIG from "./database/configDb.js";
import GLOBAL_CONSTANTS from "./constants/constants.js";
import RequestPromise from "request-promise";

const { BrokerAsPromised: Broker } = Rascal;
const s3 = new AWS.S3({
  accessKeyId: GLOBAL_CONSTANTS.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: GLOBAL_CONSTANTS.AWS_S3_SECRET_ACCESS_KEY,
});

const queueReceive = GLOBAL_CONSTANTS.QUEUE_NAME;

const executeGetTokenMetaMap = async (params) => {
  const {
    clientId = GLOBAL_CONSTANTS.CLIENT_ID,
    clientSecret = GLOBAL_CONSTANTS.CLIENT_SECRET,
  } = params;
  try {
    const response = await RequestPromise({
      url: "https://api.getmati.com/oauth",
      method: "POST",
      headers: {
        encoding: "UTF-8",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      auth: {
        user: clientId,
        pass: clientSecret,
      },
      json: true,
      body: "grant_type=client_credentials",
      rejectUnauthorized: false,
    });
    const token =
      isNil(response) === false && isNil(response.access_token) === false
        ? response.access_token
        : "";

    return token;
  } catch (error) {
    throw error;
  }
};

const executeSetMetamapConfig = async (params) => {
  const {
    idSystemUser = null,
    idLoginHistory = null,
    idCustomer = null,
    token,
    key = GLOBAL_CONSTANTS.KEY_METAMAP_CONFIG,
    offset = GLOBAL_CONSTANTS.OFFSET,
  } = params;
  const storeProcedure = "metamapSch.USPgetMetamapConfig";
  const locationCode = {
    function: "executeSetMetamapConfig",
    file: "index.js",
    container: "pml-metamap-system",
  };

  try {
    const pool = await sql.connect();
    const result = await pool
      .request()
      .input("p_uidIdSystemUser", sql.NVarChar, idSystemUser)
      .input("p_uidIdLoginHistory", sql.NVarChar, idLoginHistory)
      .input("p_uidIdCustomer", sql.NVarChar, idCustomer)
      .input("p_nvcToken", sql.NVarChar(sql.MAX), token)
      .input("p_nvcKey", sql.NVarChar(256), key)
      .input("p_chrOffset", sql.Char(6), offset)
      .execute(storeProcedure);
    const resultRecordset =
      isEmpty(result) === false &&
      isEmpty(result.recordset) === false &&
      isNil(result.recordset) === false
        ? result.recordset
        : {};
    const resultRecordsetObject =
      isEmpty(resultRecordset) === false &&
      isNil(resultRecordset[0]) === false &&
      isEmpty(resultRecordset[0]) === false
        ? resultRecordset[0]
        : [];
    if (resultRecordsetObject.stateCode !== 200) {
      throw resultRecordsetObject.errorDetail;
    }
  } catch (error) {
    throw error;
  }
};

const executeGetMetamapConfig = async (params) => {
  const { key, offset } = params;
  const storeProcedure = "metamapSch.USPgetMetamapConfig";
  const locationCode = {
    function: "executeGetMetamapConfig",
    file: "index.js",
    container: "pml-metamap-system",
  };

  try {
    const pool = await sql.connect();
    const result = await pool
      .request()
      .input("p_uidIdSystemUser", sql.NVarChar, null)
      .input("p_uidIdLoginHistory", sql.NVarChar, null)
      .input("p_uidIdCustomer", sql.NVarChar, null)
      .input("p_nvcToken", sql.NVarChar(sql.MAX), null)
      .input("p_nvcKey", sql.NVarChar(256), key)
      .input("p_chrOffset", sql.Char(6), offset)
      .execute(storeProcedure);

    const resultRecordset =
      isEmpty(result) === false &&
      isEmpty(result.recordset) === false &&
      isNil(result.recordset) === false
        ? result.recordset
        : {};
    const resultRecordsetObject =
      isEmpty(resultRecordset) === false &&
      isNil(resultRecordset[0]) === false &&
      isEmpty(resultRecordset[0]) === false
        ? resultRecordset[0]
        : [];

    let tokenMetaMap = null;
    if (resultRecordsetObject.stateCode !== 200) {
      tokenMetaMap = await executeGetTokenMetaMap({});
      throw resultRecordsetObject.message;
    } else {
      if (resultRecordsetObject.canBeRefreshed === true) {
        tokenMetaMap = await executeGetTokenMetaMap({
          clientId: resultRecordsetObject.clientId,
          clientSecret: resultRecordsetObject.clientSecret,
        });
        await executeSetMetamapConfig({
          token: tokenMetaMap,
          key,
          offset,
        });
      } else {
        tokenMetaMap = resultRecordsetObject.token;
      }
    }
    return tokenMetaMap;
  } catch (error) {
    throw error;
  }
};

const executeUploadDocument = async (params) => {
  const {
    idDocument,
    bucketSource,
    resource,
    offset = GLOBAL_CONSTANTS.OFFSET,
  } = params;

  const storeProcedure = "docSch.USPsetCustomerInDocument";
  const locationCode = {
    function: "executeSetCustomerInDocument",
    file: "systemUser.js",
  };
  const key = GLOBAL_CONSTANTS.KEY_CUSTOMER_IN_DOCUMENT;

  try {
    const response = await RequestPromise({
      url: resource,
      method: "GET",
      encoding: null,
      resolveWithFullResponse: true,
    });
    const stringContent = response.headers["content-type"];
    const separate =
      isNil(stringContent) === false && isEmpty(stringContent) === false
        ? stringContent.split("/")
        : "";
    const extension =
      isNil(separate) === false &&
      isNil(separate) === false &&
      isNil(separate[1]) === false
        ? separate[1]
        : "";

    const pool = await sql.connect();
    const result = await pool
      .request()
      .input("p_uidIdSystemUser", sql.NVarChar, null)
      .input("p_uidIdLoginHistory", sql.NVarChar, null)
      .input("p_uidIdCustomer", sql.NVarChar, null)
      .input("p_uidIdDocument", sql.NVarChar, idDocument)
      .input("p_vchName", sql.VarChar(256), idDocument)
      .input("p_vchExtension", sql.VarChar(16), extension)
      .input("p_nvcMimeType", sql.NVarChar(1024), stringContent)
      .input("p_nvcMetadata", sql.NVarChar(512), null)
      .input("p_nvcKey", sql.NVarChar(126), key)
      .input("p_bitIsActive", sql.Bit, true)
      .input("p_chrOffset", sql.Char(6), offset)
      .execute(storeProcedure);
    const resultRecordset = result.recordset[0];
    if (resultRecordset.stateCode !== 200) {
      throw resultRecordset.errorMessage;
    } else {
      const bufferFile = Buffer.from(response.body, "utf8");
      const paramsFileAws = {
        Bucket: bucketSource,
        Key: idDocument,
        Body: bufferFile,
      };
      await s3.upload(paramsFileAws).promise();
    }
  } catch (err) {
    throw err;
  }
};

const executeSetMetamapWebhook = async (params) => {
  const jsonParseServiceResponse = JSON.parse(params);
  let jsonVerificationData = null;
  const storeProcedure = "metamapSch.USPsetMetamapWebhook";
  const locationCode = {
    function: "executeSetMetamapWebhook",
    file: "index.js",
    container: "pml-metamap-system",
  };
  const offset = GLOBAL_CONSTANTS.OFFSET;
  const key = GLOBAL_CONSTANTS.KEY_METAMAP_CONFIG;
  try {
    if (
      jsonParseServiceResponse.eventName === "verification_updated" ||
      jsonParseServiceResponse.eventName === "verification_completed"
    ) {
      const responseToken = await executeGetMetamapConfig({
        offset,
        key,
      });
      const responseResource = await RequestPromise({
        url: jsonParseServiceResponse.resource,
        method: "GET",
        headers: {
          encoding: "UTF-8",
        },
        auth: {
          bearer: responseToken,
        },
        json: true,
        rejectUnauthorized: false,
      });
      jsonVerificationData = JSON.stringify(responseResource);
    }
    const pool = await sql.connect();
    const result = await pool
      .request()
      .input("p_nvcJsonServiceResponse", sql.NVarChar(sql.MAX), params)
      .input(
        "p_nvcJsonVerificationData",
        sql.NVarChar(sql.MAX),
        jsonVerificationData
      )
      .input("p_chrOffset", sql.Char, offset)
      .execute(storeProcedure);
    const resultRecordset =
      isEmpty(result) === false &&
      isEmpty(result.recordset) === false &&
      isNil(result.recordset) === false
        ? result.recordset
        : {};
    const resultRecordsetObject =
      isEmpty(resultRecordset) === false &&
      isNil(resultRecordset[0]) === false &&
      isEmpty(resultRecordset[0]) === false
        ? resultRecordset[0]
        : [];
    const resultUploadDocument =
      isEmpty(result) === false &&
      isNil(result.recordsets) === false &&
      isNil(result.recordsets[1]) === false &&
      isEmpty(result.recordsets[1]) === false
        ? result.recordsets[1]
        : [];
    if (resultRecordsetObject.stateCode !== 200) {
      throw resultRecordsetObject.errorMessage;
    } else {
      for (const element of resultUploadDocument) {
        await executeUploadDocument({
          idDocument: element.idDocument,
          bucketSource: element.bucketSource,
          resource: element.resource,
        });
      }
    }
  } catch (error) {
    throw error;
  }
};

sql.connect(CONFIG, async (error, res) => {
  if (error) {
  }
  if (res) {
    try {
      const broker = await Broker.create(config);
      broker.on("error", console.error);
      broker.on("close", console.error);
      const subscription = await broker.subscribe("fromMetaMap");

      subscription
        .on("message", async (message, content, ackOrNack) => {
          try {
            const contentString = JSON.stringify(content);
            await executeSetMetamapWebhook(contentString);
            ackOrNack(message);
          } catch (error) {
            ackOrNack(error, { strategy: "nack" });
          }
        })
        .on("error", console.error);
    } catch (error) {
      console.log("error", error);
    }
  }
});
