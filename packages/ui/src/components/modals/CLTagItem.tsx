/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
import * as React from 'react'
import { IPickerItemProps, Icon, ITag } from 'office-ui-fabric-react'

export interface ICLPickerItemProps<T> extends IPickerItemProps<T> {
    locked: boolean
    strike: boolean
    highlight: boolean
    children: string
}

export const CLTagItem = (props: ICLPickerItemProps<ITag>) => (
    <div
        className={`ms-TagItem ${props.highlight ? 'ms-TagItem-text--highlight' : ''}`}
        data-selection-index={props.index}
        data-is-focusable={!props.disabled && true}
        data-testid="tag-item"
    >
        <span
            className={`ms-TagItem-text ${props.strike ? 'ms-TagItem-text--strike' : ''}`}
            aria-label={props.children}
        >
            {props.children}
        </span>
        {!props.disabled && !props.locked &&
            <span
                className={'ms-TagItem-close'}
                onClick={props.onRemoveItem}
                role="button"
            >
                <Icon iconName='Cancel' />
            </span>
        }
    </div>
)

export default CLTagItem