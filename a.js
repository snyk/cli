/* eslint-disable no-undef */
/* eslint-disable no-redeclare */

// ❌ INSTEAD OF concatenating query params
// --
const url = `{$baseUrl}?query1=${value1}&query2=${value2}`;

// ✅ USE the beautiful Node.js url module
//    and it's method URLSearchParams
// --
import * as url from 'url';
const urlQueryParams = new url.URLSearchParams({
  query1: 'value1',
  query2: 'value2',
});
urlQueryParams.toString(); // query1=value1&query2=value2

// ✅ USE URLSearchParams to append and send
// --
const urlQueryParams = new URLSearchParams();
URLSearchParams.append('query1', value1);
URLSearchParams.append('query2', value2);
this.http.post(baseUrl, URLSearchParams.toString());
