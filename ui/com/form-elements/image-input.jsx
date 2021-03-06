'use babel'
import React from 'react'
import { createHash } from 'multiblob/util'
import pull from 'pull-stream'
import app from '../../lib/app'

const CANVAS_SIZE = 512

if (!('URL' in window) && ('webkitURL' in window))
  window.URL = window.webkitURL

export default class ImageInput extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      editorMsg: false,

      // drag state
      dragging: false,
      mx: undefined,
      my: undefined,

      // rendering parameters
      ox: 0,
      oy: 0,
      scaleSliderValue: 0,
      zoom: 1,
      minzoom: 1,

      rotation: 0,

      // image buffer
      hasImg: false,
      img: undefined,
      imgdim: undefined
    }
  }

  onRotate(e) {
    e.preventDefault()
    e.stopPropagation()
    this.setState({ rotation: (this.state.rotation + 1) % 4}, () => {
      this.drawCanvas()
    })
  }

  componentDidMount() {
    if (!this.props.current)
      return

    // load current image into the canvas
    this.setState({ editorMsg: 'loading...', hasImg: true })
    let img = document.createElement('img')
    img.src = this.props.current
    img.onload = () => {
      let imgdim = { width: img.width, height: img.height }
      const smallest = (imgdim.width < imgdim.height) ? imgdim.width : imgdim.height
      this.refs.scaleSlider.value = 0

      this.setState({
        img: img,
        imgdim: imgdim,
        editorMsg: 'Zoom:',
        ox: 0,
        oy: 0,
        zoom: CANVAS_SIZE/smallest,
        minzoom: CANVAS_SIZE/smallest,
      })
      this.drawCanvas()
    }
  }

  onClickFile(e) {
    e.preventDefault()
    e.stopPropagation()
    const fileInput = this.refs.fileInput
    if (fileInput)
      fileInput.click()
  }

  onFileChosen(e) {
    this.setState({ editorMsg: 'loading...', hasImg: true })

    const fileInput = this.refs.fileInput
    var file = fileInput.files[0]
    var reader = new FileReader()
    reader.onload = e => {
      const img = document.createElement('img')
      img.src = e.target.result

      const imgdim = { width: img.width, height: img.height }
      const smallest = (imgdim.width < imgdim.height) ? imgdim.width : imgdim.height
      this.refs.scaleSlider.value = 0
      this.setState({
        img: img,
        imgdim: imgdim,
        editorMsg: 'Zoom:',
        ox: 0,
        oy: 0,
        zoom: CANVAS_SIZE/smallest,
        minzoom: CANVAS_SIZE/smallest
      })
      this.drawCanvas()
    }
    reader.readAsDataURL(file)
  }

  onCanvasMouseDown (e) {
    e.preventDefault()
    this.setState({
      dragging: true,
      mx: e.clientX,
      my: e.clientY
    })
    this.drawCanvas()
  }

  onCanvasMouseUp (e) {
    e.preventDefault()
    this.setState({ dragging: false })
    this.drawCanvas()
  }

  onCanvasMouseMove (e) {
    e.preventDefault()
    if (this.state.dragging) {
      this.setState({
        ox: Math.max(Math.min(this.state.ox + e.clientX - this.state.mx, 0), -this.state.imgdim.width * this.state.zoom + CANVAS_SIZE),
        oy: Math.max(Math.min(this.state.oy + e.clientY - this.state.my, 0), -this.state.imgdim.height * this.state.zoom + CANVAS_SIZE),
        mx: e.clientX,
        my: e.clientY
      })
      this.drawCanvas()
    }
  }

  onResize (e) {
    const scaleSlider = this.refs.scaleSlider
    const scaleSliderValue = scaleSlider.value
    this.setState({
      scaleSliderValue: scaleSliderValue,
      zoom: this.state.minzoom + (scaleSliderValue / 100)
    })
    this.drawCanvas()
  }

  drawCanvas () {
    if (!this.state.img)
      return
    const canvas = this.refs.canvas
    const ctx = canvas.getContext('2d')
    ctx.globalCompositeOperation = 'source-over'
 
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
		ctx.save()

    ctx.scale(this.state.zoom, this.state.zoom)
    ctx.translate(this.state.ox, this.state.oy)
  	ctx.translate(this.state.img.width/2, this.state.img.height/2)
		ctx.rotate(this.state.rotation/2 * Math.PI)
		ctx.drawImage(
      this.state.img, 
      -this.state.img.width/2, -this.state.img.height/2,
      this.state.img.width, this.state.img.height
    )
		ctx.restore()
  }

  render() {
    return <div className="image-input">
      <div>
        <label>
          <span>{this.props.label}</span>
          <input ref="fileInput" type="file" accept="image/png,image/jpg,image/jpeg" onChange={this.onFileChosen.bind(this)} style={{display: 'none'}} />
          <button className="btn" onClick={this.onClickFile.bind(this)}>Choose File</button>
        </label>
      </div>
      { this.state.hasImg ? 
        <div className="image-input-ctrls">
          <div className="flex" style={{color: 'gray', alignItems: 'center'}}>
            <div style={{whiteSpace: 'pre', paddingRight: '15px'}}>
              <label>Rotation: <button className="btn" onClick={this.onRotate.bind(this)}>{(this.state.rotation*90)+' degrees'}</button></label>
            </div>
            <div style={{flex: 1, paddingRight: '5px'}}>
              { this.state.editorMsg ? <div>{this.state.editorMsg}</div> : '' }
              <input ref="scaleSlider" type="range" value={this.state.scaleSliderValue} onChange={this.onResize.bind(this)} style={{height: '45px', verticalAlign: 'middle'}} />
            </div>
          </div>
          <canvas ref="canvas" width={CANVAS_SIZE} height={CANVAS_SIZE}
            onMouseDown={this.onCanvasMouseDown.bind(this)}
            onMouseUp={this.onCanvasMouseUp.bind(this)}
            onMouseOut={this.onCanvasMouseUp.bind(this)}
            onMouseMove={this.onCanvasMouseMove.bind(this)} />
        </div>
        : '' }
    </div>
  }

  static canvasToPng(canvas, cb) {
    canvas.toBlob(function (blob) {
      var reader = new FileReader()
      reader.onloadend = function () {
        cb(null, new Buffer(new Uint8Array(reader.result)))
      }
      reader.readAsArrayBuffer(blob)
    })
  }

  static uploadCanvasToBlobstore(canvas, cb) {
    ImageInput.canvasToPng(canvas, function (err, buffer) {
      if (err) return cb(err)
      app.ssb.patchwork.addFileToBlobs(buffer.toString('base64'), function (err, hash) {
        if (err) return cb(err)
        cb(null, { hash: hash, size: buffer.length })
      })
    })
  }
}
