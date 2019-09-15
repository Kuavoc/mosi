class Game {

    constructor(world, el) {
        this.world = world

        this.wrapper = document.createElement('div')
        this.wrapper.style.position = 'relative'
        this.wrapper.style.paddingTop = '100%'
        this.wrapper.style.margin = '0 auto'
        el.appendChild(this.wrapper)

        this.canvas = document.createElement('canvas')
        this.canvas.width = world.roomWidth * world.spriteWidth
        this.canvas.height = world.roomHeight * world.spriteHeight
        this.canvas.style.position = 'absolute'
        this.canvas.style.display = 'block'
        this.canvas.style.top = '0'
        this.canvas.style.left = '0'
        this.canvas.style.width = '100%'
        this.wrapper.appendChild(this.canvas)
        this.context = this.canvas.getContext('2d')

        this.dialog = new Text({
            fontData: world.fontData,
            fontDirection: world.fontDirection,
            wrapper: this.wrapper,
            padding: Math.floor(world.spriteWidth * world.fontResolution),
            width: world.roomWidth * world.spriteWidth * world.fontResolution,
            height: world.roomHeight * world.spriteHeight * world.fontResolution
        })

        this.frameRate = 400

        this.begin = () => {
            let { spriteList } = this.world

            // get avatar
            this.avatar = spriteList.find(sprite => sprite.isAvatar) || spriteList[0]
            this.avatarX = 0
            this.avatarY = 0
            this.inventory = {}

            // initialize animations variables
            this.lastTimestamp = 0
            this.timeToNextFrame = 0
            this.timeToNextInput = 0
            this.frameIndex = 0
            this.spriteFrameList = {}
            this.avatarDirection = 'right'

            // initialize dialog variables
            this.showDialog = false
            this.delayedActions = []

            // get starting room
            this.moveRooms(this.startingRoom())

            // initialize event handling
            this.keyActive = false
            this.keyCodes = []
            this.addEventListeners()

            // kick off update loop
            this.update(0)
        }

        this.end = () => {
            this.removeEventListeners()
            window.cancelAnimationFrame(this.animationRequest)
        }

        this.update = (timestamp) => {
            let dt = timestamp - this.lastTimestamp
            this.lastTimestamp = timestamp

            let {
                roomWidth,
                roomHeight,
                spriteList,
                spriteWidth,
                spriteHeight,
                paletteList
            } = this.world

            // progress frames
            this.timeToNextFrame -= dt
            if (this.timeToNextFrame <= 0) {
                this.frameIndex++
                if (this.frameIndex >= 12) this.frameIndex = 0
                this.timeToNextFrame = this.frameRate
            }

            // update avatar
            this.timeToNextInput -= dt
            if (this.timeToNextInput <= 0) {
                if (!this.showDialog) this.updateAvatar()
                this.timeToNextInput = 200
            }

            // get current tiles and colors
            let tileList = this.currentRoom.tileList
            let palette = paletteList[this.currentPaletteIndex]
            let colorList = palette.colorList
            
            // draw background
            this.context.fillStyle = colorList[0]
            this.context.fillRect(0, 0, spriteWidth * roomWidth, spriteHeight * roomHeight)

            // draw sprites
            tileList.forEach(tile => {
                let { spriteName, x, y } = tile
                let sprite = spriteList.find(sprite => sprite.name === spriteName)
                if (sprite && !sprite.isAvatar) {
                    let xOffset = x * sprite.width
                    let yOffset = y * sprite.height
                    let frameList = this.spriteFrameList[sprite.name]
                    let frameIndex = this.frameIndex % frameList.length
                    let frameData = frameList[frameIndex]
                    this.context.drawImage(frameData, xOffset, yOffset)
                }
            })

            this.drawAvatar()

            // draw dialog
            if (this.showDialog) {
                this.dialog.draw(timestamp)
            }

            // see you next frame!
            this.animationRequest = window.requestAnimationFrame(this.update)
        }

        this.updateAvatar = () => {
            let {
                worldWidth,
                worldHeight,
                worldWrapHorizontal,
                worldWrapVertical,
                roomWidth,
                roomHeight,
                roomList
            } = this.world

            let x = this.avatarX
            let y = this.avatarY
            let roomX = Math.floor(this.currentRoomIndex % worldWidth)
            let roomY = Math.floor(this.currentRoomIndex / worldWidth)
            let stopMoving = false

            // check input
            if (this.keyActive) {
                let key = this.keyCodes[this.keyCodes.length - 1]
                if (key === 'ArrowLeft') {
                    x--
                    this.avatarDirection = 'left'
                } else if (key === 'ArrowRight') {
                    x++
                    this.avatarDirection = 'right'
                } else if (key === 'ArrowUp') {
                    y--
                } else if (key === 'ArrowDown') {
                    y++
                }
            } else if (this.pointerIsDown || this.oneMoreMove) {
                let dx = this.pointerEndPos.x - this.pointerStartPos.x
                let dy = this.pointerEndPos.y - this.pointerStartPos.y

                if (dx * dx + dy * dy > 20 * 20) {
                    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 180
                    if (angle > 45 && angle <= 135) {
                        y--
                    } else if (angle > 135 && angle <= 225) {
                        x++
                        this.avatarDirection = 'right'
                    } else if (angle > 225 && angle <= 315) {
                        y++
                    } else {
                        x--
                        this.avatarDirection = 'left'
                    }
                    this.movesSinceLastTouch++
                    this.oneMoreMove = false
                }
            }

            // check if avatar is going outside of room bounds
            if (x < 0) {
                x = roomWidth - 1
                roomX--
            }
            if (x >= roomWidth) {
                x = 0
                roomX++
            }
            if (y < 0) {
                y = roomHeight - 1
                roomY--
            }
            if (y >= roomHeight) {
                y = 0
                roomY++
            }

            // check if avatar is going outside of world bounds
            if (roomX < 0) {
                if (worldWrapHorizontal) roomX = worldWidth - 1
                else stopMoving = true
            }
            if (roomX >= worldWidth) {
                if (worldWrapHorizontal) roomX = 0
                else stopMoving = true
            }
            if (roomY < 0) {
                if (worldWrapVertical) roomY = worldHeight - 1
                else stopMoving = true
            }
            if (roomY >= worldHeight) {
                if (worldWrapVertical) roomY = 0
                else stopMoving = true
            }
            if (stopMoving) return
            
            // check for tile interactions
            let roomIndex = (roomY * worldWidth) + roomX
            let tempPosition = { roomIndex, x, y }
            let tileIsClear = this.checkTiles(roomIndex, tempPosition)
            if (!tileIsClear) stopMoving = true

            // remove tiles
            roomList.forEach(r => {
                r.tileList = r.tileList.filter(tile => !tile.removeMe)
            })

            // finalize avatar movement
            if (!stopMoving) {
                this.avatarX = tempPosition.x
                this.avatarY = tempPosition.y
                if (tempPosition.roomIndex !== this.currentRoomIndex) this.moveRooms(tempPosition.roomIndex)
            }
        }

        this.checkTiles = (roomIndex, tempPosition) => {
            let { spriteList, roomList } = this.world
            let room = roomList[roomIndex]
            let tileIsClear = true
            room.tileList.forEach(tile => {
                if (tile.x !== tempPosition.x || tile.y !== tempPosition.y) return
                let sprite = spriteList.find(s => s.name === tile.spriteName)
                if (sprite.isAvatar) return
                // wall
                if (sprite.isWall) {
                    tileIsClear = false
                }
                // item
                if (sprite.isItem) {
                    this.addToInventory(sprite.name, 1)
                    tile.removeMe = true
                }
                // behaviors - only do if not already on this tile
                if (tempPosition.x !== this.avatarX || tempPosition.y !== this.avatarY) {
                    let pushBehavior = sprite.behaviorList.find(b => b.event === 'push')
                    if (pushBehavior) {
                        pushBehavior.actionList.forEach((action, i) => {
                            this.runAction({ action, tile, tempPosition, id: 'push-' + i, roomIndex })
                        })
                    }
                }
            })
            return tileIsClear
        }

        this.runAction = ({ action, tile, tempPosition, id, roomIndex }) => {
            let { roomHeight, roomList, spriteList, paletteList } = this.world
            if (window.DEBUG === true) console.log(`${action.type.toUpperCase()} action (room ${roomIndex}, tile ${tile.x}×${tile.y})`)

            if (this.showDialog) {
                this.delayedActions.push(
                    this.runAction.bind(this, { action, tile, tempPosition, id, roomIndex })
                )
                return
            }
            
            if (action.type === 'dialog') {
                let displayAtBottom = tempPosition.y < roomHeight / 2
                this.beginDialog(action.text, displayAtBottom)
            }
            else if (action.type === 'give_item') {
                let { isGiving, spriteName, quantity } = action
                if (!isGiving) quantity *= -1
                this.addToInventory(spriteName, quantity)
            }
            else if (action.type === 'transform_self') {
                tile.spriteName = action.spriteName
                let newSprite = spriteList.find(s => s.name === action.spriteName)
                let palette = paletteList[this.currentPaletteIndex]
                let colorList = palette.colorList
                this.cacheSprite(newSprite, colorList)
            }
            else if (action.type === 'move_avatar') {
                tempPosition.roomIndex = action.roomIndex
                tempPosition.x = action.tileX
                tempPosition.y = action.tileY
            }
            else if (action.type === 'remove_self') {
                tile.removeMe = true
            }
            else if (action.type === 'trigger_event') {
                roomList.forEach((r, ri) => {
                    r.tileList.forEach(t => {
                        let s = spriteList.find(s => s.name === t.spriteName)
                        let eventBehavior = s.behaviorList.find(b => b.event === action.eventName)
                        if (eventBehavior) {
                            eventBehavior.actionList.forEach((a, i) => {
                                if (a.type === 'trigger_event' && a.eventName === action.eventName) return // don't re-trigger the same event
                                this.runAction({ action: a, tile: t, tempPosition, id: action.eventName + '-' + i, roomIndex: ri })
                            })
                        }
                    })
                })
            }
            else if (action.type === 'conditional') {
                let { comparison, spriteName, quantity, actionList } = action
                let numItems = this.inventory[spriteName] || 0
                if ((comparison === '=' && numItems === quantity) ||
                    (comparison === '!=' && numItems !== quantity) ||
                    (comparison === '<' && numItems < quantity) ||
                    (comparison === '<=' && numItems <= quantity) ||
                    (comparison === '>' && numItems > quantity) ||
                    (comparison === '>=' && numItems >= quantity)
                ) {
                    actionList.forEach((a, i) => this.runAction({ action: a, tile, tempPosition, id: id + '-' + i, roomIndex }))
                }
            }
            else if (action.type === 'sequence') {
                let { isLooping, isShuffled, actionList } = action

                let listOfIndices = (num) => {
                    if (isShuffled) {
                        let shuffledList = []
                        while (shuffledList.length < num) {
                            let index = Math.floor(Math.random() * num)
                            if (!shuffledList.includes(index)) shuffledList.push(index)
                        }
                        return shuffledList
                    } else {
                        return Array(num).fill(0).map((_, i) => i)
                    }
                }

                if (!tile.seqIndexList) tile.seqIndexList = {}
                if (!tile.seqIndexList[id]) tile.seqIndexList[id] = 0

                if (!tile.seqOrderList) tile.seqOrderList = {}
                if (!tile.seqOrderList[id]) tile.seqOrderList[id] = listOfIndices(actionList.length)

                // run current action
                let i = tile.seqOrderList[id][tile.seqIndexList[id]]
                let a = actionList[i]
                this.runAction({ action: a, tile, tempPosition, id: id + '-' + i, roomIndex })

                // get next action
                tile.seqIndexList[id]++
                if (tile.seqIndexList[id] >= actionList.length) {
                    if (isLooping) {
                        tile.seqIndexList[id] = 0
                        if (isShuffled) tile.seqOrderList[id] = listOfIndices(actionList.length)
                    } else {
                        tile.seqIndexList[id] = actionList.length - 1
                    }
                }
            }
        }

        this.addToInventory = (item, quantity) => {
            if (!this.inventory[item]) this.inventory[item] = 0
            this.inventory[item] += quantity
            if (this.inventory[item] < 0) this.inventory[item] = 0
        }

        this.startingRoom = () => {
            let { roomList } = this.world
            let roomIndex = 0
            roomList.forEach((room, i) => {
                room.tileList.forEach(tile => {
                    if (tile.spriteName === this.avatar.name) {
                        roomIndex = i
                        this.avatarX = tile.x
                        this.avatarY = tile.y
                    }
                })
            })
            return roomIndex
        }

        this.moveRooms = (roomIndex) => {
            let { roomList, paletteList } = this.world
            this.currentRoomIndex = roomIndex
            this.currentRoom = roomList[this.currentRoomIndex]
            this.currentPaletteIndex = paletteList.findIndex(p => p.name === this.currentRoom.paletteName)
            this.cacheSprites()
        }

        this.nextFrames = () => {
            Object.keys(this.spriteFrameIndexList).forEach(key => {
                let frameIndex = this.spriteFrameIndexList[key]

                this.frameIndex = frameIndex || 0
                if (this.frameIndex >= this.frameCanvasList.length) {
                    this.frameIndex = 0
                }
            })
        }

        this.drawFrame = (frame, width, context) => {
            frame.forEach((pixel, i) => {
                let x = Math.floor(i % width)
                let y = Math.floor(i / width)
                if (pixel) context.fillRect(x, y, 1, 1)
            })
        }

        this.getFrameData = (frame, color, flipped, bgColor) => {
            let { spriteWidth, spriteHeight } = this.world

            let frameCanvas = document.createElement('canvas')
            frameCanvas.width = spriteWidth
            frameCanvas.height = spriteHeight

            let context = frameCanvas.getContext('2d')
            if (flipped) {
                context.translate(spriteWidth, 0)
                context.scale(-1, 1)
            }

            if (bgColor) {
                context.fillStyle = bgColor
                context.fillRect(0, 0, spriteWidth, spriteHeight)
            }

            context.fillStyle = color
            this.drawFrame(frame, spriteWidth, context)
            
            let frameData = frameCanvas
            return frameData
        }

        this.cacheSprite = (sprite, colorList, flipped) => {
            let name = sprite.name + (flipped ? '__flipped' : '')
            let colorIndex = sprite.colorIndex
            while (colorIndex > 0 && !colorList[colorIndex]) colorIndex--
            let color = colorList[colorIndex]
            let bgColor = sprite.isTransparent ? null : colorList[0]
            
            if (sprite && !this.spriteFrameList[name]) {
                this.spriteFrameList[name] = sprite.frameList.map(frame => {
                    return this.getFrameData(frame, color, flipped, bgColor)
                })
            }
        }

        this.cacheSprites = () => {
            let { spriteList, paletteList } = this.world
            let tileList = this.currentRoom.tileList
            let palette = paletteList[this.currentPaletteIndex]
            let colorList = palette.colorList

            this.spriteFrameList = {}

            tileList.forEach(tile => {
                let { spriteName } = tile
                let sprite = spriteList.find(sprite => sprite.name === spriteName)
                this.cacheSprite(sprite, colorList)
            })

            this.cacheSprite(this.avatar, colorList)
            this.cacheSprite(this.avatar, colorList, true)
        }

        this.drawAvatar = () => {
            let { spriteWidth, spriteHeight } = this.world
            let name = this.avatar.name
            if (this.avatarDirection === 'left') name += '__flipped'

            let frameList = this.spriteFrameList[name]
            let frameIndex = this.frameIndex % frameList.length
            let frameData = frameList[frameIndex]
            this.context.drawImage(frameData, this.avatarX * spriteWidth, this.avatarY * spriteHeight)
        }

        this.beginDialog = (string, displayAtBottom) => {
            this.showDialog = true
            this.dialog.begin(string, displayAtBottom)
            this.pointerIsDown = false
        }

        this.endDialog = () => {
            this.showDialog = false
            this.dialog.end()

            while (this.delayedActions.length > 0 && !this.showDialog) {
                let runDelayedAction = this.delayedActions.shift()
                runDelayedAction()
            }
        }

        this.addEventListeners = () => {
            document.addEventListener('keydown', this.keyDown)
            document.addEventListener('keyup', this.keyUp)

            this.wrapper.addEventListener('mousedown', this.pointerStart)
            document.addEventListener('mouseup', this.pointerEnd)
            document.addEventListener('mousemove', this.pointerMove)
    
            this.wrapper.addEventListener('touchstart', this.pointerStart, { passive: false })
            document.addEventListener('touchend', this.pointerEnd, { passive: false })
            document.addEventListener('touchcancel', this.pointerEnd, { passive: false })
            document.addEventListener('touchmove', this.pointerMove, { passive: false })

            window.addEventListener('resize', this.resize)
            this.resize()
        }

        this.removeEventListeners = () => {
            document.removeEventListener('keydown', this.keyDown)
            document.removeEventListener('keyup', this.keyUp)

            this.wrapper.removeEventListener('mousedown', this.pointerDown)
            document.removeEventListener('mouseup', this.pointerEnd)
            document.removeEventListener('mousemove', this.pointerMove)
    
            this.wrapper.removeEventListener('touchstart', this.pointerDown)
            document.removeEventListener('touchend', this.pointerEnd)
            document.removeEventListener('touchcancel', this.pointerEnd)
            document.removeEventListener('touchmove', this.pointerMove)
            
            window.removeEventListener('resize', this.resize)
        }

        this.keyDown = (e) => {
            if (e.key.startsWith('Arrow')) e.preventDefault() // prevent arrow keys from scrolling page
            if (e.repeat) return // ignore key repeats
            if (this.showDialog) {
                if (e.key.startsWith('Arrow')) {
                    if (this.dialog.isComplete()) {
                        this.endDialog()
                    } else {
                        this.dialog.finishPage()
                    }
                }
            } else {
                this.keyActive = true
                this.keyCodes.push(event.key)
                this.timeToNextInput = 0
            }
        }

        this.keyUp = (e) => {
            this.keyCodes = this.keyCodes.filter(keyCode => keyCode !== e.key)
            if (this.keyCodes.length === 0) this.keyActive = false
        }

        this.pointerStart = (e) => {
            e.preventDefault()
            let pointer = e.touches ? e.touches[0] : e
            this.pointerIsDown = true
            this.movesSinceLastTouch = 0
            this.pointerStartPos = {
                x: pointer.clientX,
                y: pointer.clientY
            }
            this.pointerEndPos = {
                x: pointer.clientX,
                y: pointer.clientY
            }
            this.timeToNextInput = 0
        }

        this.pointerMove = (e) => {
            if (this.pointerIsDown) {
                e.preventDefault()
                let pointer = e.touches ? e.touches[0] : e
                this.pointerEndPos = {
                    x: pointer.clientX,
                    y: pointer.clientY
                }
            }
        }

        this.pointerEnd = (e) => {
            if (this.pointerIsDown) {
                e.preventDefault()
                this.pointerIsDown = false
                if (this.showDialog) {
                    if (this.dialog.isComplete()) {
                        this.endDialog()
                    } else {
                        this.dialog.finishPage()
                    }
                } else {
                    if (this.movesSinceLastTouch === 0) {
                        this.oneMoreMove = true
                        this.timeToNextInput = 0
                    }
                }
            }
        }

        this.resize = () => {
            let width = this.canvas.width
            let height = this.canvas.height
            let widthRatio = width > height ? 1 : width / height
            let heightRatio = width > height ? height / width : 1
            this.wrapper.style.width = widthRatio * 100 + '%',
            this.wrapper.style.paddingTop = heightRatio * 100 + '%'
        }
    }

}
