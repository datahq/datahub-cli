const test = require('ava')

const toArray = require('stream-to-array')

const utils = require('../lib/utils/data.js')

// ====================================
// isUrl

test('Tests if given path is url or not', t => {
  let notUrl = 'not/url/path'
  let res = utils.isUrl(notUrl)
  t.false(res)
  notUrl = '/not/url/path/'
  res = utils.isUrl(notUrl)
  t.false(res)
  let url = 'https://test.com'
  res = utils.isUrl(url)
  t.true(res)
  url = 'http://test.com'
  res = utils.isUrl(url)
  t.true(res)
  url = 'HTTP://TEST.COM'
  res = utils.isUrl(url)
  t.true(res)
  url = '//test.com'
  res = utils.isUrl(url)
  t.true(res)
})

// ====================================
// parsePath

test('parsePath function with local path', t => {
  const path_ = 'test/fixtures/sample.csv'
  const res = utils.parsePath(path_)
  t.is(res.path, path_)
  t.is(res.pathType, 'local')
  t.is(res.name, 'sample')
  t.is(res.format, 'csv')
  t.is(res.mediatype, 'text/csv')
})

test('parsePath function with remote url', t => {
  const path_ = 'https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv'
  const res = utils.parsePath(path_)
  t.is(res.path, path_)
  t.is(res.pathType, 'remote')
  t.is(res.name, 'vix-daily')
  t.is(res.format, 'csv')
  t.is(res.mediatype, 'text/csv')
})


// ====================================
// Resource class

// common method to test all the functionality which we can use for all types of resources
const testResource = async (t, resource) => {
  t.is(resource.path, 'test/fixtures/sample.csv')
  t.is(resource.size, 46)
  t.is(resource.hash, 'sGYdlWZJioAPv5U2XOKHRw==')
  
  // test stream
  let stream = await resource.stream
  let out = await toArray(stream)
  t.true(out.toString().includes('number,string,boolean'))

  // test rows
  let rowStream = await resource.rows
  let rows = await toArray(rowStream)
  t.deepEqual(rows[0], ['number', 'string', 'boolean'])
  t.deepEqual(rows[1], ['1', 'two', 'true'])
}

test('Resource class with path', async t => {
  // with path
  const path_ = 'test/fixtures/sample.csv'
  const res = utils.Resource.load(path_)
  await testResource(t, res)
})

test('Resource class with descriptor', async t => {
  const descriptor = {path: 'test/fixtures/sample.csv'}
  const obj2 = utils.Resource.load(descriptor)
  await testResource(t, obj2)
})

test('Resource with path and basePath', async t => {
  const obj3 = utils.Resource.load('sample.csv', {basePath: 'test/fixtures'})
  testResource(t, obj3)
})

test('Resource with inline JS data', async t => {
  const data = {
    name: 'abc'
  }
  const resource = utils.Resource.load({data: data})
  t.is(resource.size, 14)
  let stream = await resource.stream
  let out = await toArray(stream)
  t.is(out.toString(), JSON.stringify(data))
})

test('Resource with inline text (CSV) data', async t => {
  const data = `number,string,boolean
1,two,true
3,four,false
`
  // to make it testable with testResource we add the path but it is not needed
  const resource = utils.Resource.load({
    path: 'test/fixtures/sample.csv',
    format: 'csv',
    data: data
  })
  await testResource(t, resource)
})

test('Resource with inline array data', async t => {
  const data = [
    ['number', 'string', 'boolean'],
    [1,'two',true],
    [3,'four',false]
  ]
  // to make it testable with testResource we add the path but it is not needed
  const resource = utils.Resource.load({
    data: data
  })
  t.is(resource.size, 63)
  let stream = await resource.stream
  let out = await toArray(stream)
  t.is(out.toString(), JSON.stringify(data))

  let rows = await resource.rows
  let out2 = await toArray(rows)
  t.is(out2.length, 3)
  t.is(out2[0][0], data[0][0])
  // for some reason this fails with no difference
  // t.is(out2, data)
  // but this works ...
  t.is(JSON.stringify(out2), JSON.stringify(data))
})

test.serial('Resource class stream with url', async t => {
  // TODO: mock this out
  const url = 'https://raw.githubusercontent.com/datahq/datahub-cli/master/test/fixtures/sample.csv'
  const res = utils.Resource.load(url)
  const stream = await res.stream
  const out = await toArray(stream)
  t.true(out.toString().includes('number,string,boolean'))
})

test.serial('ResourceRemote "rows" method', async t => {
  const path_ = 'https://raw.githubusercontent.com/datahq/datahub-cli/master/test/fixtures/sample.csv'
  let res = utils.Resource.load(path_)
  let rowStream = await res.rows
  let out = await toArray(rowStream)
  t.deepEqual(out[0], ['number', 'string', 'boolean'])
  t.deepEqual(out[1], ['1', 'two', 'true'])
})

// ====================================
// Package class

test('Package constructor works', t => {
  const pkg = new utils.Package()
  t.deepEqual(pkg.identifier, {
    path: null,
    owner: null
  })
  t.deepEqual(pkg.descriptor, {})
  t.deepEqual(pkg.path, null)
  t.is(pkg.readme, null)
})

test('Package.load works with co2-ppm', async t => {
  let path = 'test/fixtures/co2-ppm'
  const pkg2 = await utils.Package.load(path)
  t.deepEqual(pkg2.identifier, {
    path: path,
    type: 'local'
  })
  t.deepEqual(pkg2.path, path)

  t.is(pkg2.descriptor.name, 'co2-ppm')
  t.is(pkg2.resources.length, 6)
  t.is(pkg2.resources[0].descriptor.name, 'co2-mm-mlo')
  t.is(pkg2.resources[0].path, 'test/fixtures/co2-ppm/data/co2-mm-mlo.csv')
  t.true(pkg2.readme.includes('CO2 PPM - Trends in Atmospheric Carbon Dioxide.'))
})
