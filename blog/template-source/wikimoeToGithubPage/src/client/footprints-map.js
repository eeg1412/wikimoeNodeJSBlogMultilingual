;(function () {
  function escHtml(text) {
    var node = document.createElement('div')
    node.textContent = text || ''
    return node.innerHTML
  }

  function init(config) {
    if (
      !config ||
      !config.markers ||
      !config.markers.length ||
      typeof window.ol === 'undefined'
    ) {
      return
    }

    var popup = document.getElementById(config.popupDomId || 'ol-popup')
    var popupContent = document.getElementById(
      config.popupContentDomId || 'ol-popup-content'
    )
    var popupClose = document.getElementById(
      config.popupCloseDomId || 'ol-popup-close'
    )
    var targetId = config.mapDomId || 'ol-map'
    var siteUrl = config.siteUrl || ''
    var markers = config.markers
    var worldGeoJsonPath =
      config.worldGeoJsonPath || '/openlayers/geojson/world-mid.json'

    var centerLon = 0
    var centerLat = 0
    markers.forEach(function (marker) {
      centerLon += marker.longitude
      centerLat += marker.latitude
    })
    centerLon /= markers.length
    centerLat /= markers.length

    var overlay = new window.ol.Overlay({
      element: popup,
      autoPan: true,
      autoPanAnimation: { duration: 250 }
    })

    var worldSource = new window.ol.source.Vector({ wrapX: true })
    var worldLayer = new window.ol.layer.Vector({
      source: worldSource,
      style: new window.ol.style.Style({
        fill: new window.ol.style.Fill({ color: 'rgba(75, 123, 236, 0.12)' }),
        stroke: new window.ol.style.Stroke({
          color: 'rgba(75, 123, 236, 0.25)',
          width: 1
        })
      })
    })

    var markerSource = new window.ol.source.Vector({ wrapX: true })
    var markerLayer = new window.ol.layer.Vector({
      source: markerSource,
      declutter: true
    })
    var labelSource = new window.ol.source.Vector({ wrapX: true })
    var labelLayer = new window.ol.layer.Vector({
      source: labelSource,
      declutter: true
    })

    var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    var pointRadius = isTouchDevice ? 7 : 6
    var labelOffsetY = isTouchDevice ? -17 : -16
    var rootStyle = getComputedStyle(document.documentElement)
    var primaryColor =
      rootStyle.getPropertyValue('--primary').trim() || '#4b7bec'
    var textColor = rootStyle.getPropertyValue('--text').trim() || '#1f2937'
    var bgColor = rootStyle.getPropertyValue('--bg').trim() || '#ffffff'

    var map = new window.ol.Map({
      target: targetId,
      layers: [worldLayer, markerLayer, labelLayer],
      overlays: [overlay],
      interactions: window.ol.interaction.defaults.defaults({
        altShiftDragRotate: false,
        pinchRotate: false
      }),
      controls: window.ol.control.defaults
        .defaults({ zoom: false, rotate: false, attribution: false })
        .extend([
          new window.ol.control.Zoom({
            zoomInTipLabel: '放大',
            zoomOutTipLabel: '缩小'
          })
        ]),
      view: new window.ol.View({
        center: window.ol.proj.fromLonLat([centerLon, centerLat]),
        zoom: config.defaultZoom || 5,
        minZoom: 1,
        maxZoom: 18
      })
    })

    fetch(siteUrl + worldGeoJsonPath)
      .then(function (response) {
        return response.json()
      })
      .then(function (geojson) {
        var features = new window.ol.format.GeoJSON().readFeatures(geojson, {
          featureProjection: 'EPSG:3857'
        })
        worldSource.addFeatures(features)
      })
      .catch(function () {})

    markers.forEach(function (marker, index) {
      var position = window.ol.proj.fromLonLat([
        marker.longitude,
        marker.latitude
      ])
      var zIndex = marker.zIndex || 0 - index

      var pointFeature = new window.ol.Feature({
        geometry: new window.ol.geom.Point(position),
        markerData: marker
      })
      pointFeature.setStyle(
        new window.ol.style.Style({
          image: new window.ol.style.Circle({
            radius: pointRadius,
            declutterMode: 'obstacle',
            fill: new window.ol.style.Fill({ color: primaryColor }),
            stroke: new window.ol.style.Stroke({ color: '#ffffff', width: 2 })
          }),
          zIndex: zIndex
        })
      )
      markerSource.addFeature(pointFeature)

      if (marker.title) {
        var labelFeature = new window.ol.Feature({
          geometry: new window.ol.geom.Point(position),
          markerData: marker
        })
        labelFeature.setStyle(
          new window.ol.style.Style({
            image: new window.ol.style.Circle({
              radius: pointRadius,
              declutterMode: 'declutter',
              fill: new window.ol.style.Fill({ color: 'rgba(0,0,0,0)' }),
              stroke: new window.ol.style.Stroke({
                color: 'rgba(0,0,0,0)',
                width: 2
              })
            }),
            text: new window.ol.style.Text({
              text: marker.title,
              declutterMode: 'declutter',
              offsetY: labelOffsetY,
              fill: new window.ol.style.Fill({ color: textColor }),
              stroke: new window.ol.style.Stroke({ color: bgColor, width: 3 }),
              font: '12px sans-serif'
            }),
            zIndex: zIndex
          })
        )
        labelSource.addFeature(labelFeature)
      }
    })

    var hitTolerance = isTouchDevice ? 8 : 0
    map.on('click', function (event) {
      var feature = map.forEachFeatureAtPixel(
        event.pixel,
        function (candidate) {
          return candidate
        },
        {
          layerFilter: function (layer) {
            return layer === markerLayer || layer === labelLayer
          },
          hitTolerance: hitTolerance
        }
      )

      if (!feature) {
        popup.style.display = 'none'
        overlay.setPosition(undefined)
        return
      }

      var data = feature.get('markerData')
      var position = window.ol.proj.fromLonLat([data.longitude, data.latitude])
      var html = '<div class="ol-popup-title">' + escHtml(data.title) + '</div>'
      if (data.summary) {
        html +=
          '<div class="ol-popup-summary">' + escHtml(data.summary) + '</div>'
      }
      if (data.postCount > 0 && data.href) {
        html +=
          '<a class="ol-popup-link" href="' +
          escHtml(data.href) +
          '">查看文章（' +
          data.postCount +
          '篇）→</a>'
      }
      popupContent.innerHTML = html
      popup.style.display = ''
      overlay.setPosition(position)
    })

    map.on('pointermove', function (event) {
      if (event.dragging) {
        return
      }

      var hit = map.hasFeatureAtPixel(event.pixel, {
        layerFilter: function (layer) {
          return layer === markerLayer || layer === labelLayer
        }
      })
      map.getTargetElement().style.cursor = hit ? 'pointer' : ''
    })

    if (popupClose) {
      popupClose.addEventListener('click', function () {
        popup.style.display = 'none'
        overlay.setPosition(undefined)
      })
    }
  }

  window.WikimoeTemplateFootprints = {
    init: init
  }
})()
