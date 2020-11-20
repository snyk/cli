module.exports = datetime;

// https://reproducible-builds.org/docs/source-date-epoch/
function datetime() {
    return new Date(process.env.SOURCE_DATE_EPOCH ? (process.env.SOURCE_DATE_EPOCH * 1000) : new Date().getTime());
}
