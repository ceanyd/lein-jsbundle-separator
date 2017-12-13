'use strict';
const fs = require('fs');
const child_process = require('child_process');
const resolve = require('path').resolve;

const replace = (str, subStr, cutStart, cutEnd) => {
  return str.substr(0, cutStart) + subStr + str.substr(cutEnd + 1);
};

const createNewDirectory = (dir) => {
  const arr = dir.split('/');
  let arrData = '';
  arr.forEach((n) => {
    if (n === '.') return arrData = n;
    arrData = arrData + '/' + n;
    if (!fs.existsSync(arrData)) {
      fs.mkdirSync(arrData);
    }
  });
};

const checkOnSlash = (data, lastIndex, bool) => {
  let slashIndex = lastIndex - 1;
  let _bool = bool;
  if (bool && data[slashIndex] === '\\') {
    while (data[slashIndex] === '\\') {
      slashIndex--;
    }
    if (!((lastIndex - (slashIndex + 1)) % 2)) _bool = !_bool;
  } else {
    _bool = !_bool;
  }
  return _bool;
};

const changeOldRequires = (str, backDir) => {
  let _str = str;
  let reqInd = _str.indexOf('require(".');

  while (reqInd >= 0) {
    reqInd = reqInd + 9;
    _str = replace(_str, backDir + '..', reqInd, reqInd);
    reqInd = _str.indexOf('require(".', reqInd);
  }
  return _str;
};

const deleteFolderRecursive = (path) => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file, index) => {
      const curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

const create = (data, dir, firstIndex = 0) => {
  let tree = {};
  let _data = data;
  let index = firstIndex;
  let isVar = false;
  while (_data[index]) {
    let nextIndex = index;
    let nextSymbol = _data[nextIndex];
    while (nextSymbol === '\n' || nextSymbol === ' ') {
      nextIndex++;
      nextSymbol = _data[nextIndex];
    }

    let lastIndex = nextIndex,
      lastSymbol = _data[lastIndex],
      isDef = false,
      bracketsOpened = 0,
      singleQuotesOpened = false,
      doubleQuotesOpened = false,
      regex = false,
      fullProperty = lastSymbol;

    if (lastSymbol) {
      while ((isVar ? !lastSymbol.match(/[,;]/) : !lastSymbol.match(/;/)) || bracketsOpened !== 0 || regex || doubleQuotesOpened || singleQuotesOpened || (_data[lastIndex + 1] !== 'v' && lastSymbol !== ',')) {
        if (lastSymbol === '=' && !fullProperty.slice(0, fullProperty.length - 1).match(/[=!(){}:,;]/) && _data[lastIndex + 1] !== '=') {
          const fullPropertyArr = fullProperty.split(' ');
          if (fullProperty.indexOf(' ') > 0) {
            if (fullPropertyArr[0] === 'var' || fullProperty.indexOf('[') < fullProperty.indexOf(' ')) {
              isVar = true;
              isDef = true;
            } else {
              throw Error(`Unacceptable JS code: ${fullProperty}`);
            }
          } else {
            if (isVar) fullProperty = 'var ' + fullProperty;
            isDef = true;
          }
        }

        if (!singleQuotesOpened && !doubleQuotesOpened && !regex) {
          if (!!lastSymbol.match(/[({[]/)) bracketsOpened++;
          if (!!lastSymbol.match(/[)}\]]/)) bracketsOpened--;
        }

        if (!!lastSymbol.match(/"/) && !singleQuotesOpened && !regex) doubleQuotesOpened = checkOnSlash(_data, lastIndex, doubleQuotesOpened);
        if (!!lastSymbol.match(/'/) && !doubleQuotesOpened && !regex) singleQuotesOpened = checkOnSlash(_data, lastIndex, singleQuotesOpened);
        if (!!lastSymbol.match(/\//) && !singleQuotesOpened && !doubleQuotesOpened && (_data[lastIndex - 1].match(/[=(,?:]/) || regex)) regex = checkOnSlash(_data, lastIndex, regex);

        lastIndex++;
        lastSymbol = _data[lastIndex];
        if (bracketsOpened < 0 || (lastSymbol === undefined && bracketsOpened > 0)) {
          throw Error(`JS code unacceptable: ${!lastSymbol ? 'file ended, but brackets are opened ' + bracketsOpened : ''}${bracketsOpened < 0 ? 'bracketsOpened ' + bracketsOpened : ''}`);
        }

        if (bracketsOpened === 0 && lastSymbol === undefined) {
          break;
        }
        fullProperty = fullProperty + lastSymbol;

        if (lastSymbol === ';' && _data[lastIndex + 1] && _data[lastIndex + 1].match(/[\n\s]/)) {
          lastIndex++;
          let _lastSymbol = _data[lastIndex + 1];
          while (_lastSymbol.match(/[\n\s]/)) {
            lastIndex++;
            _lastSymbol = _data[lastIndex + 1];
          }
        }
      }

      if (isDef) {
        let branch = fullProperty.slice(0, fullProperty.indexOf('='));
        let pureProp = fullProperty.slice(branch.length + 1); // '.'
        if (pureProp[pureProp.length - 1] === ',') pureProp = pureProp.slice(0, pureProp.length - 1) + ';';
        else isVar = false;
        if (branch.indexOf(' ') > 0 && branch.split(' ')[0] === 'var') {
          branch = branch.split(' ')[1];
        }
        const treeKeys = Object.keys(tree);// Math.imul
        let args = '';
        if(pureProp.indexOf('Math.imul') >= 0) args = '{Math,';
        args = treeKeys.reduce((acc, key, ind) => {
          if(pureProp.indexOf(key) >= 0) return (!acc.length ? '{' : '') + acc + key + (ind === treeKeys.length - 1 ? '}' : ',');
          return ((ind === treeKeys.length - 1 && acc.length) ? acc.slice(0, acc.length - 1) + '}' : acc);
        }, args);
        tree[branch] = {pureProp, args};
        const newProperty = `var ${branch}=require("${dir}/${branch}")(${args});`;

        let _nextIndex = nextIndex + 2;
        let _prevSymbol = _data[_nextIndex];

        while (_prevSymbol !== ';' && _prevSymbol !== undefined && _nextIndex >= firstIndex) {
          _nextIndex--;
          _prevSymbol = _data[_nextIndex];
        }
        _data = replace(_data, newProperty, _nextIndex + 1, lastIndex);
        index = _nextIndex + 1 + newProperty.length;
      } else {
        index = index + fullProperty.length;
      }
    } else {
      index = lastIndex;
    }

  }
  console.log('Parse was ended');
  console.log('Creating of chunk files...');

  const createNestedDirs = (_branchObj, _dir, defaultName = '') => {
    const nestedDir = _dir + (defaultName ? '/' + defaultName : '');
    // const nestedDirArr = nestedDir.split('/');
    let backDir = '';

    // if (nestedDirArr.length > 2) backDir = nestedDirArr.reduce((acc, next, _ind) => {
    //   if (_ind < 2) return acc;
    //   return acc + '../';
    // }, backDir);
    // else backDir = './';

    createNewDirectory(nestedDir);
    const branchObjKeys = Object.keys(_branchObj);

    branchObjKeys.forEach(key => {
      const pureProp = _branchObj[key].pureProp;
      const args = _branchObj[key].args;
      let newValue = changeOldRequires(pureProp, backDir);
      newValue = `function ${key}_func(${args}){var ${key}=${newValue}return ${key}};module.exports=${key}_func;`;

      fs.writeFileSync(`${nestedDir}/${key}.js`, newValue);
    });
  };
  createNestedDirs(tree, dir);

  console.log('Chunk files are created');
  return _data;
};

const main = (param) => {
  const file = resolve(`index.${param}.js`);
  console.log(`Start parse file ${file} on modules...`);
  const log = `Dividing for ${file} was ended`;
  console.time(log);
  const data = fs.readFileSync(file, 'utf8');
  const path = resolve(`./${param}_prod_src`);
  deleteFolderRecursive(path);
  const newData = create(data, path, 450); // TODO: from 450 symbol parse started and to the end. Add to args.
  fs.writeFileSync(file, newData);
  console.timeEnd(log);
  console.log('------------');
};

const lein = (platform) => {
  if(!platform) platform = '';
  else platform = `-${platform}`;
  console.log(`Execute lein prod-build${platform}...(~${platform ? '1 min' : '2 min'})`);
  const timeLog = 'Build was ended';
  console.time(timeLog);
  child_process.execSync(`lein prod-build${platform}`);
  console.timeEnd(timeLog);
  console.log('------------');
};

if(process.argv.length < 3 || process.argv.filter(arg => arg === 'ios' || arg === 'android').length === 2) {
  lein();
  main('android');
  main('ios');
} else {
  const wrongParams = [];
  process.argv.forEach((param, i) => {
    if (i < 2) return;
    if(param === 'android' || param === 'ios') {
      lein(param);
      deleteFolderRecursive(resolve(`${param ===  'ios' ? 'android' : 'ios'}_prod_src`));
      main(param);
    } else {
      wrongParams.push(param);
    }
  });
  if(wrongParams.length) console.log(`Wrong params(${wrongParams.join(',')}): only "android", "ios" or ""`);
}

console.log('Dividing is ended');
