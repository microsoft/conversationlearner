/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as CLM from '@conversationlearner/models'
import * as IntlMessages from '../react-intl-messages'
import { MessageValue } from 'react-intl'
import * as moment from 'moment'
import * as stringify from 'fast-json-stable-stringify'

export function notNullOrUndefined<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

export function equal<T extends number | string | boolean>(as: T[], bs: T[]): boolean {
    return as.length === bs.length
        && as.every((a, i) => a === bs[i])
}

export function replace<T>(xs: T[], updatedX: T, getId: (x: T) => object | number | string): T[] {
    const index = xs.findIndex(x => getId(x) === getId(updatedX))
    if (index < 0) {
        throw new Error(`You attempted to replace item in list with id: ${getId(updatedX)} but no item could be found.  Perhaps you meant to add the item to the list or it was already removed.`)
    }

    return [...xs.slice(0, index), updatedX, ...xs.slice(index + 1)]
}

export function isNullOrUndefined(object: any) {
    return object === null || object === undefined

}
export function isNullOrWhiteSpace(str: string | null): boolean {
    return (!str || str.length === 0 || /^\s*$/.test(str))
}

export function entityDisplayName(entity: CLM.EntityBase) {
    if (entity.positiveId) {
        return `-${entity.entityName.slice(1)}`;
    } else if (entity.negativeId) {
        return `+${entity.entityName}`;
    } else {
        return entity.entityName;
    }
}

export function packageReferences(app: CLM.AppBase): CLM.PackageReference[] {
    return [
        ...app.packageVersions,
        {
            packageId: app.devPackageId,
            packageVersion: 'Master'
        }
    ]
}

export function createEntityMapFromMemories(entities: CLM.EntityBase[], memories: CLM.Memory[]): Map<string, string> {
    return memories.reduce((map, m) => {
        const entity = entities.find(e => e.entityName === m.entityName)
        if (entity !== undefined) {
            map.set(entity.entityId, CLM.memoryValuesAsString(m.entityValues))
        }
        return map
    }, new Map<string, string>())
}

export const CL_DEMO_ID = '4433d65080bc95c0f2bddd26b5a0c816d09619cd4f8be0fec99fd2944e536888'
export function isDemoAccount(userId: string): boolean {
    return userId.indexOf(CL_DEMO_ID) > -1
}

// TODO: Remove coupling with the start character on ActionPayloadEditor
export function getDefaultEntityMap(entities: CLM.EntityBase[]): Map<string, string> {
    return entities.reduce((m, e) => m.set(e.entityId, `$${e.entityName}`), new Map<string, string>())
}

export function setStateAsync(that: any, newState: any) {
    return new Promise((resolve) => {
        that.setState(newState, () => {
            resolve();
        });
    });
}

export const delay = <T>(ms: number, value?: T): Promise<T> => new Promise<T>(resolve => setTimeout(() => resolve(value), ms))

export function getDefaultText(id: IntlMessages.FM): string {
    return IntlMessages.default["en-US"].hasOwnProperty(id) ? IntlMessages.default["en-US"][id] : ""
}

export function formatMessageId(intl: ReactIntl.InjectedIntl, id: IntlMessages.FM, values?: { [key: string]: MessageValue }) {
    return intl.formatMessage({
        id: id,
        defaultMessage: getDefaultText(id)
    }, values)
}

export function earlierDateOrTimeToday(timestamp: string): string {
    const endOfYesterday = moment().endOf("day").subtract(1, "day")
    const dialogTime = moment(timestamp)
    const isDialogCreatedToday = dialogTime.diff(endOfYesterday) >= 0
    return dialogTime.format(isDialogCreatedToday ? 'LTS' : 'L')
}

export function isActionUnique(newAction: CLM.ActionBase, actions: CLM.ActionBase[]): boolean {
    const normalizedNewAction = normalizeActionAndStringify(newAction)
    const normalizedExistingActions = actions.map(action => normalizeActionAndStringify(action))
    const isUnique = !normalizedExistingActions.some(straw => straw === normalizedNewAction)
    return isUnique
}

function normalizeActionAndStringify(newAction: CLM.ActionBase) {
    const { actionId, createdDateTime, packageCreationId, packageDeletionId, version, ...normalizedNewAction } = newAction
    return stringify(normalizedNewAction)
}

export function deepCopy<T>(obj: T): T {
    let copy: any;

    // Simple types, null or undefined
    if (obj === null || typeof obj !== "object") {
        return obj
    }

    // Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy as T;
    }

    // Array
    if (obj instanceof Array) {
        copy = [];
        obj.forEach((item, index) => copy[index] = deepCopy(obj[index]))
        return copy as T;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        Object.keys(obj).forEach(attr => {
            if (obj.hasOwnProperty(attr)) {
                copy[attr] = deepCopy(obj[attr])
            }
        })
        return copy as T;
    }

    throw new Error("Unknown Type");
}

export const returnStringWhenError = (s: string) => {
    return <T>(f: () => T): T | string => {
        try {
            return f()
        }
        catch (err) {
            return s
        }
    }
}

export const setEntityActionDisplay = (action: CLM.ActionBase, entities: CLM.EntityBase[]): [string, string] => {
    let name = `MISSING ENTITY`
    let value = `MISSING VALUE`

    const entity = entities.find(e => e.entityId === action.entityId)
    if (entity) {
        name = entity.entityName
        if (entity.entityType !== CLM.EntityType.ENUM) {
            value = `Entity Is Not Enum!`
        }
        else if (entity.enumValues) {
            const enumValueObj = entity.enumValues.find(en => en.enumValueId === action.enumValueId)
            if (enumValueObj) {
                value = enumValueObj.enumValue
            }
        }
    }

    return [name, value]
}

export const getSetEntityActionsFromEnumEntity = (entity: CLM.EntityBase): CLM.ActionBase[] => {
    if (entity.entityType !== CLM.EntityType.ENUM) {
        throw new Error(`You attempted to create set entity actions from an entity that was not an ENUM. Entity: ${entity.entityName} - ${entity.entityType}`)
    }

    if (!entity.enumValues) {
        throw new Error(`You attempted to create set entity actions from an entity which had no enum values. Entity: ${entity.entityName} - ${entity.entityType}`)
    }

    return entity.enumValues.map(evo => {
        if (!evo.enumValueId) {
            throw new Error(`You attempted to create a set entity action from entity whose enum values have not yet been saved and don't have valid id. Please save the entity first. Entity: ${entity.entityName} - ${entity.entityType}`)
        }

        return getSetEntityActionForEnumValue(entity.entityId, evo.enumValueId)
    })
}

export const PLACEHOLDER_SET_ENTITY_ACTION_ID = 'PLACEHOLDER_SET_ENTITY_ACTION_ID'
export const getSetEntityActionForEnumValue = (entityId: string, enumValueId: string): CLM.ActionBase => {
    const setEntityPayload: CLM.SetEntityPayload = {
        entityId,
        enumValueId,
    }

    const payload = JSON.stringify(setEntityPayload)

    return {
        actionId: PLACEHOLDER_SET_ENTITY_ACTION_ID,
        actionType: CLM.ActionTypes.SET_ENTITY,
        payload,
        createdDateTime: new Date().toJSON(),
        isTerminal: false,
        requiredEntitiesFromPayload: [],
        requiredEntities: [],
        negativeEntities: [],
        requiredConditions: [],
        negativeConditions: [],
        suggestedEntity: null,
        version: 0,
        packageCreationId: 0,
        packageDeletionId: 0,
        entityId,
        enumValueId,
    }
}