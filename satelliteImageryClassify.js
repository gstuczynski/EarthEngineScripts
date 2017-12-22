
var geometry = ee.Geometry.Polygon([
  [-91.54975891113281,29.559123451577964], 
  [-91.55731201171875,29.425843050184266],
  [-91.2359619140625,29.404908690410327],
  [-91.22566223144531,29.53045010749106],
  [-91.54975891113281,29.559123451577964]
  ]);

var l5visParams = {
  bands: ["B4","B3","B2"],
  gamma: 1,
  max: 58.33357724490378,
  min: 30.318773779304806,
  opacity: 1
};

var s2visParams = {
  bands: ["B12","B8","B2"],
  gamma: 1,
  max: 3110,
  min: 637.5,
  opacity: 1
};

var trainingPoints = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-91.397, 29.4201]), {class: 0}),
  ee.Feature(ee.Geometry.Point([-91.377775, 29.49026]), {class: 0}),
  ee.Feature(ee.Geometry.Point([-91.5213, 29.4459]), {class: 0}), 
  ee.Feature(ee.Geometry.Point([-91.2418, 29.4088]), {class: 0}), 
  ee.Feature(ee.Geometry.Point([-91.307, 29.5319]), {class: 1}),
  ee.Feature(ee.Geometry.Point([-91.33724, 29.53582]), {class: 1}),
  ee.Feature(ee.Geometry.Point([-91.3835, 29.54299]), {class: 1}),
  ee.Feature(ee.Geometry.Point([-91.29313, 2952429]), {class: 1}),
]);

var l5 = ee.ImageCollection('LANDSAT/LT05/C01/T1')
  .filterBounds(geometry);
  
var s2 = ee.ImageCollection('COPERNICUS/S2')
  .filterBounds(geometry);

var modis = ee.ImageCollection('WHBU/NBAR_1YEAR')

print(modis)//.clip(geometry))

var medianByYear = function(img, list, year){
  return ee.List(list).add(
    img.filterDate(year+'-01-01',year+'12-31')
       .median()
       .clip(geometry)
    ), year+1
}

var vectorizeAll = function(){
  var start = 1984;
  var end = 2011;
  var y = start;
  var l5yearVectorized = ee.List([]);
  //Point should always be in water - for masked purpose
  var point = ee.Geometry.Point([-91.40162, 29.43047]);

  while(y<=end){
    var img = l5.filterDate(y+'-01-01', y+'-12-30')
                .median()
                .clip(geometry);
                
    var training = img.sample({
      scale: 30,
      numPixels: 5000
    });
  
    var clusterer = ee.Clusterer.wekaKMeans(2).train(training);
    var res = img.cluster(clusterer).set({'year': y});
    //In k-means algoritm i can't control either land or water get value
    var pointValue = res.select('cluster')
                        .reduceRegion(ee.Reducer.first(), point, 10)
                        .get('cluster');
                        
    var zones = res.gt(0).add(res.gt(1));
    zones = zones.updateMask(zones.neq(ee.Number(pointValue))).set({'year': y});
    var vectors = zones.addBands(res).reduceToVectors({
      crs:res.projection(),
      scale:1000,
    })
    Map.addLayer(zones, {palette:['blue', 'red']}, 'Vector '+y, false)
    l5yearVectorized = l5yearVectorized.add(zones)
    y++;
  }
  print(ui.Chart.image.series(l5yearVectorized, geometry, ee.Reducer.count(), 1000, 'year' ));
}

var showLayer = function(year, collection, name, imageVisParam, computed) {
  
  var image;
  
  if(computed){
    //for modis - used year sepparate collection
    print(collection.filterMetadata('system:index', 'equals', String(year)).first())
   image = collection
          .filterMetadata('system:index', 'equals', String(year))
          .first()
  }else {  

  var date = ee.Date.fromYMD(year, 1, 1);
  var dateRange = ee.DateRange(date, date.advance(1, 'year'));
  image = collection.filterDate(dateRange)
                .median();
  }
  image = ee.Image(image).clip(geometry)
  Map.addLayer({
    eeObject: ee.Image(image),
   // visParams: imageVisParam,
    name: String(name + ': ' + year)
  });
};

var l5ShowLayer = function(year){
  showLayer(year, l5, 'Landsat 5', l5visParams)
}
var s2ShowLayer = function(year){
  showLayer(year, s2, 'Sentinel 2', s2visParams)
}
var modisShowLayer = function(year){
  showLayer(year, modis, 'Modis', s2visParams, true)
}

var clustering = function(){
  var img = Map.layers().get(0).get('eeObject')
  
  var training = img.sample({
    scale: 30,
    numPixels: 5000
  });
  
  var clusterer = ee.Clusterer.wekaKMeans(2).train(training);
  var res = img.cluster(clusterer);
  
  Map.addLayer(res.randomVisualizer());
};

var supervisedClassify = function(){
  var img = Map.layers().get(0).get('eeObject');

  Map.addLayer(trainingPoints);
  var training = img.sampleRegions({
    collection: trainingPoints,
    properties: ['class'],
    scale: 30
  });
  var trained = ee.Classifier.cart().train(training, 'class');
  
  var classified = img.classify(trained);
  Map.addLayer(classified, {min: 0, max: 1, palette: ['00FF00', 'FF0000']});
};

var label = ui.Label('Select Year:');
var l5label = ui.Label('Landsat 5');
var s2label = ui.Label('Sentinel 2');

var l5Slider = ui.Slider({
  min: 1984,
  max: 2011,
  step: 1,
  onChange: l5ShowLayer,
  style: {stretch: 'horizontal'}
});

var s2Slider = ui.Slider({
  min: 2015,
  max: 2017,
  step: 1,
  onChange: s2ShowLayer,
  style: {stretch: 'horizontal'}
});

var modisSlider = ui.Slider({
  min: 2001,
  max: 2018,
  step: 1,
  onChange: modisShowLayer,
  style: {stretch: 'horizontal'}
});

var clusteringButton = ui.Button({
  label: 'Clustering',
  onClick: clustering
});

var vectorizeAllBtn = ui.Button({
  label: 'Convert all to vector',
  onClick: vectorizeAll
});

var supevisedClassBtn = ui.Button({
  label: 'Supervised Classification',
  onClick: supervisedClassify
});

var resetBtn = ui.Button({
  label: 'Reset',
  onClick: function(){
    Map.layers().reset();
  }
});

var panel = ui.Panel({
  widgets: [label, l5label ,l5Slider, s2label, s2Slider, modisSlider,clusteringButton, supevisedClassBtn, vectorizeAllBtn, resetBtn],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    position: 'bottom-left',
    padding: '7px'
  }
});

Map.add(panel);