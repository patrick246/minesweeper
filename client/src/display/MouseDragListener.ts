import {Vector2} from "game/dist";

export type MouseListener = (position: Vector2, buttonCode: number) => void;

export class MouseDragListener {
    private dragStartPosition: Vector2 | undefined;
    private isDrag: boolean = false;
    private dragOffsetSinceLastUpdate: Vector2 = new Vector2(0, 0);

    private readonly dragListeners: MouseListener[] = [];
    private readonly clickListeners: MouseListener[] = [];

    constructor(element: HTMLElement) {
        element.addEventListener('contextmenu', (event: MouseEvent) => {
            event.preventDefault();
        });

        element.addEventListener('mousedown', (event: MouseEvent) => {
            if(event.buttons === 1) {
                this.dragStartPosition = new Vector2(event.screenX, event.screenY);
            }
        });


        element.addEventListener('mousemove', (event: MouseEvent) => {
            if(event.buttons === 0) {
                this.dragStartPosition = undefined;
                return;
            }
            if(this.dragStartPosition) {
                const newPos = new Vector2(event.screenX, event.screenY);
                this.dragOffsetSinceLastUpdate = this.dragOffsetSinceLastUpdate.add(this.dragStartPosition.subtract(newPos));

                if(Math.abs(this.dragOffsetSinceLastUpdate.x) > 8 || Math.abs(this.dragOffsetSinceLastUpdate.y) > 8) {
                    console.log('current drag offset', this.dragOffsetSinceLastUpdate);
                    this.isDrag = true;
                    this.dragListeners.forEach(cb => cb(this.dragOffsetSinceLastUpdate, event.buttons));
                    this.dragStartPosition = newPos;
                    this.dragOffsetSinceLastUpdate = new Vector2(0, 0);
                }
            }
        });
        element.addEventListener('mouseup', (event: MouseEvent) => {
            console.log(event);
            if(!this.isDrag) {
                this.clickListeners.forEach(cb => cb(new Vector2(event.x, event.y), event.button));
            }
            this.dragStartPosition = undefined;
            this.isDrag = false;
        });
    }

    public on(_: 'drag', dragFunction: MouseListener): void;

    public on(_: 'click', clickFunction: MouseListener): void;

    public on(type: string, callback: MouseListener): void {
        if(type === 'drag') {
            this.dragListeners.push(callback);
        } else if(type === 'click') {
            this.clickListeners.push(callback);
        }
    }
}