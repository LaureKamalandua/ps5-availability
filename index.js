/* 

FIXME
! Manage puppeteer Browser and Page objects in session (singleton)
! Implement class for RetailerType

TODO Implement function to consent to cookies if alert is displayed
TODO Implement the following retailers: Coolblue, Mediamarkt, Bol, Nedgame, Gamemania, Amazon, Intertoys BCC, Wehkamp.

*/

const logger = require('./logger');
const colors = require('colors');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');

class ValidatorResult {
  // This class stores the web page validation query results in a universal format
  constructor(description) {
    this.description = description;
    this.result = null;
  }
  getLog() {
    switch (this.result) {
      case true:
        return `${'✓'.green} ${this.description.grey}`;
      case false:
        return `${'x'.red} ${this.description.grey}`;
      default:
        this.description.grey;
    }
  }
}

class EvaluateQuery {
  constructor() {}
  static async calculateResult(validatorResults) {
    // This functions checks whether the validation results resolve
    // to the unit being available or not
    // Returns true (unit available) or false (unit unavailable)
    try {
      if (!Array.isArray(validatorResults)) {
        throw new Error(
          'Error occured when iterating through ValidatorResult items. No array.'
        );
      }
      let results = [];
      validatorResults.forEach(item => {
        results.push(item.result);
      });
      return results.includes(false) ? false : true;
    } catch (error) {
      logger.error(error);
    }
  }
}

class ValidatorQuery {
  constructor() {}
  static async elementExists(puppeteerPage, id) {
    // This function checks whether a HTML fragment can be found by a DOM selector on the web page
    // Returns true if HTMLElement can be found and false if not
    try {
      const element = await this.queryElement(puppeteerPage, id);
      return element !== null ? true : false;
    } catch (error) {
      logger.error(error);
    }
  }
  static async elementContains(puppeteerPage, id, string) {
    // This functions checks whether a HTML fragment contains a specific string in its innerText property
    // Returns true if the HTMLElement's innerText contains the specified string and false if not
    try {
      if (id === null || undefined) {
        // Silentently evaluate to false if the initial value does not exist
        return false;
      }
      if (typeof id === 'string') {
        const element = await this.queryElement(puppeteerPage, id);
        return await puppeteerPage.evaluate(
          (element, string) => {
            if (element !== null) {
              return element.includes(string);
            } else {
              return false;
            }
          },
          element,
          string
        );
      }
      if (typeof id === 'object') {
        const handle = await id.getProperty('innerText');
        const value = await handle.jsonValue();
        if (value !== null) {
          return value.includes(string);
        } else {
          return false;
        }
      } else {
        throw new Error(
          `The supplied parameter for id does not resolve to a string or 'ElementHandle'`
        );
      }
    } catch (error) {
      logger.debug(error);
    }
  }
  static async queryElement(puppeteerPage, id) {
    // This functions retriees the HTML element by the specified DOM selector
    // Returns the 'innerText' property of the element if it exists and 'null' if it doesn't
    try {
      let element;
      if (typeof id === 'string') {
        element = await puppeteerPage.$(id);
      } else if (typeof id === 'object') {
        element = id;
      } else {
        throw new Error(
          `The supplied parameter for id does not resolve to a string or 'ElementHandle'`
        );
      }
      return await puppeteerPage.evaluate(element => {
        if (element !== null) {
          return element.innerText;
        } else {
          return null;
        }
      }, element);
    } catch (error) {
      logger.error(error);
    }
  }
}

class Page {
  // This class provides a foundation for the Page Object Model and
  // shared methods that can be used on each web page during its lifecycle
  constructor(puppeteerPage) {
    this.puppeteerPage = puppeteerPage;
    this.job = new JobUnit();
  }
  async navigateToHome() {
    try {
      logger.debug(`Navigating to page: ${this.url}`);
      await this.puppeteerPage.goto(this.url, { waitUntil: 'networkidle2' });
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async checkAvailability() {
    // This function checks whether the PS5 unit is available for a specific retailer
    try {
      logger.info(`Checking PS5 unit availability at '${this.retailer}'`);
      await this.navigateToHome();
      if (this.suppressCookies) {
        await this.suppressCookies();
      }
      logger.debug(`Performing validation tests`);
      let valid = await this.validateOrder();

      if (valid) {
        logger.debug(`HTML page passed validation`);
        logger.debug(`Performing unit availability tests`);
        let result = await this.evaluateOrder();
        if (result) {
          logger.info(`PS5 unit is available at '${this.retailer}'`);
          this.job.result = true;
          return true;
        } else {
          logger.info(`PS5 unit is not available at '${this.retailer}'`);
          this.job.result = false;
          return false;
        }
      } else {
        logger.error('HTML form failed validation.');
        this.job.result = null;
        return null;
      }
    } catch (error) {
      throw new Error(error);
    }
  }
  async destroy() {
    logger.debug(`Closing browser page: ${await this.puppeteerPage.title()}`);
    await this.puppeteerPage.close();
  }
}

class PageBolNL extends Page {
  constructor(puppeteerPage) {
    super(puppeteerPage);
    this.retailer = 'Bol';
    this.location = 'Netherlands';
    this.region = 'europe';
    this.url =
      'https://www.bol.com/nl/p/sony-playstation-5-console/9300000004162282/';
    this.unit = 'disk_edition';
    this.formButton = '.js_preventable_buy_action';
  }
  async buttonHelper() {
    // This helper function finds the correct purchase button
    // Executes document.querySelectorAll() to find all buttons and iterates over
    // the items to find the button where the size matches
    logger.debug('Checking whether purchase button is rendered');
    let result = [];
    let buttons = await this.puppeteerPage.$$(this.formButton);
    if (buttons) {
      // Only execute if buttons have been found using the specified DOM selector
      if (buttons.length > 0) {
        for (let i = 0; i < buttons.length; i++) {
          const handle = await buttons[i].getProperty('clientWidth');
          const value = await handle.jsonValue();
          if (value === 147) {
            result.push(buttons[i]);
          }
        }
      }
    }
    if (result.length === 1) {
      logger.debug('Succesfully located 1 matching button');
      return result[0];
    } else if (result.length > 1) {
      if (result.length > 1) {
        logger.debug(
          `More than 1 buttons have been detected for 'clientWidth' matches 147 condition`
        );
        return null;
      }
    } else {
      logger.debug('No buttons were found with the specified DOM selector');
      return null;
    }
  }

  async evaluateOrder() {
    try {
      const articleNotice =
        '#mainContent > div > div.constrain.constrain--main.h-bottom--m > div.pdp-header.slot.slot--pdp-header.js_slot-title > h1 > span.sub-title';
      const buttonId = await this.buttonHelper();
      let validationResult = [];
      let evaluationResult;

      // Check whether out of stock message is rendered
      let testA = new ValidatorResult(
        `DOM element contains 'UITVERKOCHT' (true)`
      );
      testA.result = !(await ValidatorQuery.elementContains(
        this.puppeteerPage,
        articleNotice,
        'UITVERKOCHT'
      ));
      logger.debug(testA.getLog());

      // Check whether purchase button is rendered
      let testB = new ValidatorResult(
        `HTML for purchase button is rendered (false)`
      );
      testB.result = await ValidatorQuery.elementExists(
        this.puppeteerPage,
        buttonId
      );
      logger.debug(testB.getLog());

      // Check whether purchase button contains correct text
      let testC = new ValidatorResult(
        `Purchase button contains 'In winkelwagen' (false)`
      );
      testC.result = await ValidatorQuery.elementContains(
        this.puppeteerPage,
        buttonId,
        'In winkelwagen'
      );
      logger.debug(testC.getLog());

      validationResult.push(testA, testB, testC);
      evaluationResult = await EvaluateQuery.calculateResult(validationResult);

      this.job.evaluationTests = validationResult;
      return evaluationResult;
    } catch (error) {
      logger.error(error);
    }
  }
  async validateOrder() {
    // Check whether web page contains references to unit name
    let test = new ValidatorResult(
      `Article header contains 'Sony PlayStation 5 Console' (true)`
    );
    test.result = await ValidatorQuery.elementContains(
      this.puppeteerPage,
      '#mainContent > div > div.constrain.constrain--main.h-bottom--m > div.pdp-header.slot.slot--pdp-header.js_slot-title > h1 > span.h-boxedright--xs',
      'Sony PlayStation 5 Console'
    );
    logger.debug(test.getLog());
    this.job.validationTests = test;
    return test.result;
  }
}

class PageCoolBlueNL extends Page {
  constructor(puppeteerPage) {
    super(puppeteerPage);
    this.retailer = 'Coolblue';
    this.location = 'Netherlands';
    this.region = 'europe';
    this.url = 'https://www.coolblue.nl/product/865866/playstation-5.html';
    this.unit = 'disk_edition';
    this.formButton =
      '#main-content > div.grid-section-xs--gap-4.grid-section-m--gap-5 > div > div.grid-unit-xs--col-12.grid-unit-m--col-6.grid-unit-xl--col-5.js-sticky-bar-trigger > div > div.grid-section-xs--gap-4.grid-section-m--gap-5.js-order-block > div.js-desktop-order-block > div > div.grid-section-xs--gap-4.is-hidden-until-size-m > form > div.grid-section-xs--gap-4.is-hidden-until-size-m > button';
  }
  async suppressCookies() {
    // This function consents to the website's cookies policy if a prompt is shown
    try {
      const button =
        'body > div.cookie > div > div.modal-box__container.js-modal-box__container > div.modal-box__content.position--relative.js-modal-box__content > div > div > div.grid-unit-xs--col-12.grid-unit-m--col-7 > form > div > div.grid-unit-xs--col-12.grid-unit-m--col-12.space--bottom-4 > button';
      const buttonId = await this.puppeteerPage.$(button);
      if (buttonId) {
        logger.debug(`Detected prompt to consent to cookies`);
        await this.puppeteerPage
          .click(button)
          .then(() => {
            this.puppeteerPage.waitForNavigation({ waitUntil: 'networkidle0' });
          })
          .catch(error => {
            logger.error(error);
          });
        await this.puppeteerPage.goto(this.url, { waitUntil: 'networkidle0' });
      }
    } catch (error) {
      logger.error(error);
    }
  }

  async evaluateOrder() {
    try {
      const articleNotice =
        '#main-content > div.grid-section-xs--gap-4.grid-section-m--gap-5 > div > div.grid-unit-xs--col-12.grid-unit-m--col-6.grid-unit-xl--col-5.js-sticky-bar-trigger > div > div:nth-child(1) > div > div > div.icon-with-text__text > div';
      let validationResult = [];
      let evaluationResult;

      // Check whether out of stock message is rendered
      let testA = new ValidatorResult(
        `DOM element contains 'Door een beperkte voorraad' (true)`
      );
      testA.result = !(await ValidatorQuery.elementContains(
        this.puppeteerPage,
        articleNotice,
        'Door een beperkte voorraad'
      ));
      logger.debug(testA.getLog());

      // Check whether purchase button is rendered
      let testB = new ValidatorResult(`Article purchase button exists (false)`);
      testB.result = await ValidatorQuery.elementExists(
        this.puppeteerPage,
        this.formButton
      );
      logger.debug(testB.getLog());

      // Check whether purchase button contains correct text
      let testC = new ValidatorResult(
        `Purchase button contains 'In mijn winkelwagen' (false)`
      );
      testC.result = await ValidatorQuery.elementContains(
        this.puppeteerPage,
        this.formButton,
        'In mijn winkelwagen'
      );
      logger.debug(testC.getLog());

      validationResult.push(testA, testB, testC);
      evaluationResult = await EvaluateQuery.calculateResult(validationResult);
      this.job.evaluationTests = validationResult;
      return evaluationResult;
    } catch (error) {
      logger.error(error);
    }
  }
  async validateOrder() {
    // Check whether web page contains references to unit name
    let test = new ValidatorResult(
      `Article header contains 'PlayStation 5' (true)`
    );
    test.result = await ValidatorQuery.elementContains(
      this.puppeteerPage,
      '#main-content > h1 > span',
      'PlayStation 5'
    );
    logger.debug(test.getLog());
    this.job.validationTests = test;
    return test.result;
  }
}

class PageMediamarktNL extends Page {
  constructor(puppeteerPage) {
    super(puppeteerPage);
    this.retailer = 'Mediamarkt';
    this.location = 'Netherlands';
    this.region = 'europe';
    this.url =
      'https://www.mediamarkt.nl/nl/product/_sony-playstation-5-disk-edition-1664768.html';
    this.unit = 'disk_edition';
    this.formButton = '#pdp-add-to-cart';
  }
  async suppressCookies() {
    // This function consents to the website's cookies policy if a prompt is shown
    try {
      const button =
        'body > div.gdpr-cookie-layer.gdpr-cookie-layer--show > div > div.gdpr-cookie-layer__lower-section > div.gdpr-cookie-layer__submit-buttons > button.gdpr-cookie-layer__btn.gdpr-cookie-layer__btn--submit.gdpr-cookie-layer__btn--submit--all';
      const buttonId = await this.puppeteerPage.$(button);
      if (buttonId) {
        logger.debug(`Detected prompt to consent to cookies`);
        await this.puppeteerPage
          .click(button)
          .then(() => {
            this.puppeteerPage.waitForNavigation({ waitUntil: 'networkidle0' });
          })
          .catch(error => {
            logger.error(error);
          });
        await this.puppeteerPage.goto(this.url, { waitUntil: 'networkidle0' });
      }
    } catch (error) {
      logger.error(error);
    }
  }
  async evaluateOrder() {
    try {
      const articleNotice =
        '#product-details > div.price-sidebar.product-pricing.has-monthly-price > div.price-details > div.box.infobox.availability > ul > li.false.online-nostock > span';
      let validationResult = [];
      let evaluationResult;

      // Check whether out of stock message is rendered
      let testA = new ValidatorResult(
        `DOM element contains 'Online uitverkocht' (true)`
      );
      testA.result = !(await ValidatorQuery.elementContains(
        this.puppeteerPage,
        articleNotice,
        'Online uitverkocht'
      ));
      logger.debug(testA.getLog());

      // Check whether purchase button is rendered
      let testB = new ValidatorResult(`Article purchase button exists (true)`);
      testB.result = await ValidatorQuery.elementExists(
        this.puppeteerPage,
        this.formButton
      );
      logger.debug(testB.getLog());

      // Check whether purchase button contains correct text
      let testC = new ValidatorResult(
        `Purchase button contains 'Bestel nu' (true)`
      );
      testC.result = await ValidatorQuery.elementContains(
        this.puppeteerPage,
        this.formButton,
        'Bestel nu'
      );
      logger.debug(testC.getLog());

      validationResult.push(testA, testB, testC);
      evaluationResult = await EvaluateQuery.calculateResult(validationResult);
      this.job.evaluationTests = validationResult;
      return evaluationResult;
    } catch (error) {
      logger.error(error);
    }
  }
  async validateOrder() {
    // Check whether web page contains references to unit name
    let test = new ValidatorResult(
      `Article header contains 'SONY PlayStation 5 Disk Edition' (true)`
    );
    test.result = await ValidatorQuery.elementContains(
      this.puppeteerPage,
      '#product-sidebar > h1',
      'SONY PlayStation 5 Disk Edition'
    );
    logger.debug(test.getLog());
    this.job.validationTests = test;
    return test.result;
  }
}

class CLI {
  constructor() {}
  static getLogo() {
    // prettier-ignore
    return `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
      ${`⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⣀⠈⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⣿⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⡄⠀⢿⣿⣿⣿⣿⡿⠀⢀⣶⣶⣶⣶⣶⣿⣿⠀⠀⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⣿⠀⠀⠀⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠛⠛⠛⠛⠛⠛⠛⠛⠁⢀⣾⣿⣿⣿⣿⡇⠀⢸⣿⣿⣿⣿⣿⣿⣿⠀⠀⠛⠛⠛⠛⠛⠛⠛⠛⠛⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⣿⣿⣿⠿⠛⠋⢹⠀⠀⠀⣿⠶⠶⠚⠛⠿⢿⣿⣿⣿⣿⣿⣿⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⠉⠀⠀⣤⣶⠾⢻⠀⠀⠀⣇⣤⣶⠾⠛⠉⠀⢀⣿⣿⣿⣿⣿⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠉⠉⠉⠉⠉⢀⣤⣿⣿⣿⣿⣿⣿⣿⣿⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⢀⣤⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⣿⣿⣿⣶⣶⣶⣿⣀⠀⠀⡇⠀⣀⣤⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
    `.grey}
    
    ${'🥳 Welcome to the PS5 Availability Check Toolkit!'.yellow}
    
    ${'Author'}          :       ${'Laure Kamalandua'}
    ${'Email'}           :       ${'laure@quantaleap.eu'}
    ${'Repository'}      :       ${'https://github.com/LaureKamalandua/ps5-availability.git'}
    ${'Version'}         :       ${'1.0.0'}

    `;
  }
}

class Environment {
  static async createJobQueue(browser, jobList) {
    try {
      logger.info('Initializing environment');
      if (!Array.isArray(jobList)) {
        throw new Error(`The supplied parameter for 'jobList' is not an array`);
      }
      if (jobList.length > 0) {
        logger.info(`Preparing ${jobList.length} job(s): ${jobList}`);
        let jobQueue = [];
        for (let i = 0; i < jobList.length; i++) {
          let page;
          if (i === 0) {
            page = (await browser.pages())[0];
          } else {
            page = await browser.newPage();
          }
          const siteConstructor = Environment.getRetailer(jobList[i]);
          const site = new siteConstructor(page);
          site.job = new JobUnit();
          jobQueue.push(site);
        }
        return jobQueue;
      } else {
        throw new Error('No items are available in the supplied array');
      }
    } catch (error) {
      logger.error(error.message);
    }
  }
  static async runJobQueue(jobList) {
    let results = [];
    for (let i = 0; i < jobList.length; i++) {
      results.push(await jobList[i].checkAvailability());
    }
    return results;
  }
  static async checkAvailability(jobList, browser) {
    try {
      if (browser !== undefined) {
        logger.debug(`Detected existing browser instance: ${browser}`);
      } else {
        logger.debug(`Creating browser instance with default options.`);
        browser = await puppeteer.launch({
          headless: true,
          timeout: 3000,
          waitUntil: 'networkidle2',
          args: ['--start-maximized'],
          defaultViewport: {
            width: 1280,
            height: 1280
          }
        });
      }
      if (Array.isArray(jobList)) {
        let jobs = await Environment.createJobQueue(browser, jobList);
        return await Environment.runJobQueue(jobs);
      } else if (typeof jobList === 'string') {
        const page = (await browser.pages())[0];
        const retailerClass = Environment.getRetailer(jobList);
        const site = new retailerClass(page);
        site.job = new JobUnit();
        return await site.checkAvailability();
      } else {
        throw new Error(`The supplied parameter for 'jobList' is not defined`);
      }
      logger.info('Jobs have been processed. Terminating browser.');
    } catch (error) {
      logger.error(`An unexpected error occured: ${error.message}`);
    } finally {
      // Close browser instance gracefully
      if (browser) {
        const pages = await browser.pages();
        if (pages.length > 0) {
          for (let item of pages) {
            logger.debug(
              `Closing browser page: ${await item.target()._targetInfo.title}`
            );
            await item.close();
          }
        }
        logger.debug(`Terminated browser and active pages.`);
        await browser.close();
      }
    }
  }
  static getRetailer(name) {
    try {
      let result = this.retailers[name];
      if (!result) {
        throw new Error(`Retailer could not be found for value: '${name}'`);
      }
      return result;
    } catch (error) {
      logger.error(error.message);
    }
  }
}

Environment.retailers = {
  bolnl: PageBolNL,
  coolbluenl: PageCoolBlueNL,
  mediamarktnl: PageMediamarktNL
};

class JobUnit {
  constructor(options) {
    this.id = uuidv4();
    this.date = new Date();
    this.result = null;
    this.options = options ? options : null;
    this.evaluationTests = [];
    this.validationTests = [];
  }
}

logger.info(CLI.getLogo());

module.exports = {
  Environment,
  PageBolNL,
  PageCoolBlueNL,
  PageMediamarktNL,
  Page
};
