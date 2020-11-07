# Introduction

This module can be used to programatically check PS5 console availability and pre-order status at multiple retailers.

## Install

```
$ npm install ps5-availability
```

## Usage

```javascript
const { Environment: PS5 } = require('ps5-availability');

(async function init() {
  let result = PS5.checkAvailability(['mediamarktnl', 'bolnl']);
  // console.log(result) -> [false,false]
})();
```

## Retailers

Console availability is tracked for the following retailers:

| Name       | Site                       | Country     | Region | Type           |
| ---------- | -------------------------- | ----------- | ------ | -------------- |
| Bol        | https://www.bol.com/nl/    | Netherlands | Europe | `bolnl`        |
| Coolblue   | https://www.coolblue.nl/   | Netherlands | Europe | `coolbluenl`   |
| Mediamarkt | https://www.mediamarkt.nl/ | Netherlands | Europe | `mediamarktnl` |
