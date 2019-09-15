class WorldGrid extends Component {
    constructor(props) {
        super()

        this.state = {
            roomIndex: props.currentRoomIndex
        }

        this.roomTileList = []
        this.roomDataList = []
        this.roomColorList = []
        
        this.pointerStart = (e) => {
            e.preventDefault()
            let pointer = e.touches ? e.touches[0] : e
            this.pointerIsDown = true
            this.pointerPos = {
                x: pointer.clientX,
                y: pointer.clientY
            }
        }

        this.pointerMove = (e) => {
            if (this.pointerIsDown) {
                e.preventDefault()
                let pointer = e.touches ? e.touches[0] : e
                this.pointerPos = {
                    x: pointer.clientX,
                    y: pointer.clientY
                }
            }
        }

        this.pointerEnd = (e) => {
            if (this.pointerIsDown) {
                e.preventDefault()
                this.pointerIsDown = false
                this.pointerSelect()
            }
        }

        this.keyDown = (e) => {
            if (!e.key.includes('Arrow') && e.key !== ' ') return
            e.preventDefault()

            let { worldWidth, worldHeight, selectRoom } = this.props
            let { roomIndex } = this.state

            let x = Math.floor(roomIndex % worldWidth)
            let y = Math.floor(roomIndex / worldWidth)

            if (e.key === ' ') selectRoom(roomIndex)
            if (e.key === 'ArrowUp') y--
            if (e.key === 'ArrowDown') y++
            if (e.key === 'ArrowLeft') x--
            if (e.key === 'ArrowRight') x++
            if (x < 0 || y < 0 || x >= worldWidth || y >= worldHeight) {
                return
            }

            let newRoomIndex = worldWidth * y + x
            this.setState({ roomIndex: newRoomIndex })
        }

        this.keyUp = (e) => {
            if (e.key === ' ') this.spaceIsDown = false
        }

        this.pointerSelect = (e) => {
            let { worldWidth, worldHeight, selectRoom } = this.props
            let rect = this.node.getBoundingClientRect()
            let tileWidth = rect.width / worldWidth
            let tileHeight = rect.height / worldHeight
            let relX = this.pointerPos.x - rect.x
            let relY = this.pointerPos.y - rect.y
            if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) {
                return
            }

            let x = Math.floor(relX / tileWidth)
            let y = Math.floor(relY / tileHeight)
            let roomIndex = worldWidth * y + x
            selectRoom(roomIndex)
        }

        this.drawRoom = (tileList, spriteList, colorList, context) => {
            tileList.forEach(tile => {
                let sprite = spriteList.find(sprite => sprite.name === tile.spriteName)
                let colorIndex = sprite.colorIndex
                while (colorIndex > 0 && !colorList[colorIndex]) colorIndex--
                let color = colorList[colorIndex]
                context.fillStyle = color
                context.fillRect(tile.x, tile.y, 1, 1)
            })
        }

        this.cacheRooms = () => {
            let { roomWidth, roomHeight, roomList, spriteList, paletteList } = this.props
            roomList.forEach((room, i) => {
                let roomWasUpdated = room.tileList !== this.roomTileList[i]
                let palette = paletteList.find(palette => palette.name === room.paletteName)
                let paletteWasUpdated = palette.colorList !== this.roomColorList[i]
                if (roomWasUpdated || paletteWasUpdated) {
                    let backgroundColor = palette.colorList[0]
                    let roomCanvas = document.createElement('canvas')
                    roomCanvas.width = roomWidth
                    roomCanvas.height = roomHeight
                    let context = roomCanvas.getContext('2d')
                    context.fillStyle = backgroundColor
                    context.fillRect(0, 0, roomWidth, roomHeight)
                    this.drawRoom(room.tileList, spriteList, palette.colorList, context)
                    let roomData = roomCanvas
                    this.roomDataList[i] = roomData
                }
                this.roomTileList[i] = room.tileList
                this.roomColorList[i] = palette.colorList
            })
        }

        this.update = () => {
            let {
                worldWidth,
                worldHeight,
                roomWidth,
                roomHeight
            } = this.props

            let width = roomWidth * worldWidth
            let height = roomHeight * worldHeight
            
            let context = this.canvas.getContext('2d')

            context.clearRect(0, 0, width, height)

            this.roomDataList.forEach((roomData, i) => {
                let xOffset = Math.floor(i % worldWidth) * roomWidth
                let yOffset = Math.floor(i / worldWidth) * roomHeight
                context.drawImage(roomData, xOffset, yOffset)
            })
        }
    }

    componentDidMount() {
        this.node.addEventListener('mousedown', this.pointerStart)
        document.addEventListener('mousemove', this.pointerMove)
        document.addEventListener('mouseup', this.pointerEnd)
    
        this.node.addEventListener('touchstart', this.pointerStart, { passive: false })
        document.addEventListener('touchend', this.pointerEnd, { passive: false })
        document.addEventListener('touchcancel', this.pointerEnd, { passive: false })
        document.addEventListener('touchmove', this.pointerMove, { passive: false })

        this.node.addEventListener('keydown', this.keyDown)
        this.node.addEventListener('keyup', this.keyUp)

        this.cacheRooms()
        this.update()
    }

    componentWillUnmount() {
        this.node.removeEventListener('mousedown', this.pointerStart)
        document.removeEventListener('mousemove', this.pointerMove)
        document.removeEventListener('mouseup', this.pointerEnd)
    
        this.node.removeEventListener('touchstart', this.pointerStart)
        document.removeEventListener('touchend', this.pointerEnd)
        document.removeEventListener('touchcancel', this.pointerEnd)
        document.removeEventListener('touchmove', this.pointerMove)

        this.node.removeEventListener('keydown', this.keyDown)
        this.node.removeEventListener('keyup', this.keyUp)
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.currentRoomIndex !== this.props.currentRoomIndex) {
            this.setState({ roomIndex: nextProps.currentRoomIndex })
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextState.roomIndex !== this.state.roomIndex) return true
        return checkForUpdates(nextProps, this.props)
    }

    componentDidUpdate() {
        this.cacheRooms()
        this.update()
    }

    render({
        className,
        worldWidth,
        worldHeight,
        roomWidth,
        roomHeight,
        startRoomIndex
    }, {
        roomIndex
    }) {
        let tileWidth = 100 / worldWidth
        let tileHeight = 100 / worldHeight
        let tileX = Math.floor(roomIndex % worldWidth) * tileWidth
        let tileY = Math.floor(roomIndex / worldWidth) * tileHeight
        let startX = Math.floor(startRoomIndex % worldWidth) * tileWidth
        let startY = Math.floor(startRoomIndex / worldWidth) * tileHeight

        let width = worldWidth * roomWidth
        let height = worldHeight * roomHeight
        let widthRatio = width > height ? 1 : width / height
        let heightRatio = width > height ? height / width : 1

        let gridHighlight =
            div({
                className: 'grid-highlight',
                style: {
                    left: tileX + '%',
                    top: tileY + '%',
                    width: tileWidth + '%',
                    height: tileHeight + '%'
                }
            })

        let avatarHighlight = isNaN(startRoomIndex) ? null :
            div({
                className: 'avatar-highlight avatar',
                style: {
                    left: startX + '%',
                    top: startY + '%',
                    width: tileWidth + '%',
                    height: tileHeight + '%'
                }
            })

        let gridLinesRows = []
        for (let y = 0; y < worldHeight; y++) {
            let gridLinesCells = []
            for (let x = 0; x < worldWidth; x++) {
                gridLinesCells.push(
                    h('td', {
                        className: 'gridlines-cell',
                        style: {
                            width: tileWidth + '%',
                            height: tileHeight + '%'
                        }
                    })
                )
            }
            gridLinesRows.push(
                h('tr', {
                    className: 'gridlines-row',
                    style: {
                        // width: tileWidth + '%',
                        height: tileHeight + '%'
                    }
                }, gridLinesCells)
            )
        }
        let gridLines = div({ className: 'gridlines' }, h('table', {}, gridLinesRows))
        
        return div({
            className: 'grid worldgrid ' + className,
            style: {
                width: widthRatio * 100 + '%',
                paddingTop: heightRatio * 100 + '%'
            },
            ref: node => { this.node = node },
            tabindex: 0
        }, [
            canvas({
                width,
                height,
                ref: node => { this.canvas = node }
            }),
            avatarHighlight,
            gridLines,
            gridHighlight
        ])
    }
}
