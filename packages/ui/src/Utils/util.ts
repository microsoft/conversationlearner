/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as CLM from '@conversationlearner/models'
import * as IntlMessages from '../react-intl-messages'
import * as Const from '../types/const'
import * as moment from 'moment'
import * as stringify from 'fast-json-stable-stringify'
import { MessageValue } from 'react-intl'

export function notNullOrUndefined<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined
}

export function equal<T extends number | string | boolean>(as: T[], bs: T[]): boolean {
    return as.length === bs.length
        && as.every((a, i) => a === bs[i])
}

// Return random number between min and max
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

export function percentOf(count: number, total: number): string {
    if (total === 0) {
        return "-"
    }
    return `${(count / total * 100).toFixed(1)}%`
}

// Convert rgb to hex allowing for non-whole numbers
export function rgbToHex(r: number, g: number, b: number) {
    // tslint:disable:prefer-template
    // tslint:disable:no-bitwise
    return "#" + ((1 << 24) + (Math.trunc(r) << 16) + (Math.trunc(g) << 8) + Math.trunc(b)).toString(16).slice(1)
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
        return `-${entity.entityName.slice(1)}`
    } else if (entity.negativeId) {
        return `+${entity.entityName}`
    } else {
        return entity.entityName
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

/**
 * Create map of [entityId, memoryValue]
 * Assumes memory value's are associated with entity by entityName (NOT entityId)
 */
export function createEntityMapFromMemories(entities: CLM.EntityBase[], memories: CLM.Memory[]): Map<string, string> {
    return memories.reduce((map, m) => {
        const entity = entities.find(e => e.entityName === m.entityName)
        if (entity !== undefined) {
            map.set(entity.entityId, CLM.memoryValuesAsString(m.entityValues))
        }
        return map
    }, new Map<string, string>())
}

export type EntityMapEntry = {
    name: string,
    value?: string,
}

export function createEntityMapWithNamesAndValues(entities: CLM.EntityBase[], memories?: CLM.Memory[]): Record<string, EntityMapEntry> {
    return entities.reduce<Record<string, EntityMapEntry>>((map, e) => {
        const entry: EntityMapEntry = {
            name: e.entityName,
        }

        const memory = memories?.find(m => m.entityName === e.entityName)
        if (memory) {
            entry.value = CLM.memoryValuesAsString(memory.entityValues)
        }

        map[e.entityId] = entry

        return map
    }, {})
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
    Object.keys(newState).forEach(key => {
        if (!that.state.hasOwnProperty(key)) {
            throw new Error(`Object state does not contain property ${key}`)
        }
    })
    return new Promise((resolve) => {
        that.setState(newState, () => {
            resolve()
        })
    })
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
    return !normalizedExistingActions.some(straw => straw === normalizedNewAction)
}

function normalizeActionAndStringify(newAction: CLM.ActionBase) {
    const { actionId, createdDateTime, packageCreationId, packageDeletionId, version, ...normalizedNewAction } = newAction
    return stringify(normalizedNewAction)
}

export function deepCopy<T>(obj: T): T {
    let copy: any

    // Simple types, null or undefined
    if (obj === null || typeof obj !== "object") {
        return obj
    }

    // Date
    if (obj instanceof Date) {
        copy = new Date()
        copy.setTime(obj.getTime())
        return copy as T
    }

    // Map
    if (obj instanceof Map) {
        return new Map(obj) as unknown as T
    }

    // Array
    if (obj instanceof Array) {
        copy = []
        obj.forEach((item, index) => copy[index] = deepCopy(obj[index]))
        return copy as T
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {}
        Object.keys(obj).forEach(attr => {
            if ((obj as Object).hasOwnProperty(attr)) {
                copy[attr] = deepCopy(obj[attr])
            }
        })
        return copy as T
    }

    throw new Error("Unknown Type")
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
        suggestedEntity: undefined,
        version: 0,
        packageCreationId: 0,
        packageDeletionId: 0,
        entityId,
        enumValueId,
    }
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

export function readFileAsync(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e: Event) => {
            resolve(reader.result as any)
        }

        reader.onerror = reject

        reader.readAsText(file)
    })
}

// Returns true is primary template body is variable substitution
export function isTemplateTitleGeneric(template: CLM.Template): boolean {
    const titleVariable = template.variables.find(v => v.key === "title" && (v.type === "TextBlock" || v.type === "TextBody"))
    return (titleVariable !== undefined)
}

// Create recursive partial of an object
export type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>
}

export function isFeatureEnabled(featureString: string | undefined, feature: Const.FeatureStrings) {
    if (featureString?.toUpperCase().includes(feature.toUpperCase())) {
        return true
    }
    return false
}

// Generate colors that scale with number from red (neg) to green (pos)
export function scaledColor(rating?: number): string {
    if (rating === undefined) {
        return "#ffffff"
    }
    if (rating === 0) {
        // Yellow at zero
        return '#ffec8c'
    }
    if (rating > 0) {
        const scale = Math.pow(0.9, rating - 1)
        const r = scale * 224
        const g = 255
        const b = scale * 224
        return rgbToHex(r, g, b)
    }
    else {
        const scale = Math.pow(0.8, (-rating) - 1)
        const r = 255
        const g = scale * 224
        const b = scale * 224
        return rgbToHex(r, g, b)
    }
}

// Can be used by JSON.stringify to serialize Map type objects
// i.e. JSON.stringify({object with map}, mapReplacer)
export function mapReplacer(key: any, value: any) {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: [...value]
        }
    } else {
        return value
    }
}

// Can be used JSON.stringify to de-serialize Map type objects
// i.e. JSON.parse({object with map}, mapReviver)
export function mapReviver(key: any, value: any) {
    if (typeof value === 'object' && value !== null) {
        if (value.dataType === 'Map') {
            return new Map(value.value)
        }
    }
    return value
}

// Returns list of validation errors or empty array
export function appDefinitionValidationErrors(source: CLM.AppDefinition): string[] {

    // Gather up all the entity and action references
    let entityIds: string[] = []
    let actionIds: string[] = []
    source.trainDialogs.forEach(td => {
        let filledEntityIds = td.initialFilledEntities.map(ife => ife.entityId!)
        entityIds.push(...filledEntityIds)
        td.rounds.forEach(round => {
            round.extractorStep.textVariations.forEach(tv => {
                const labeledEntitiId = tv.labelEntities.map(le => le.entityId)
                entityIds.push(...labeledEntitiId)
            })
            round.scorerSteps.forEach(ss => {
                filledEntityIds = ss.input.filledEntities.map(fe => fe.entityId!)
                entityIds.push(...filledEntityIds)
                actionIds.push(ss.labelAction!)
                filledEntityIds = ss.logicResult?.changedFilledEntities.map(cfe => cfe.entityId!) || []
                entityIds.push(...filledEntityIds)
            })
        })
    })
    source.actions.forEach(a => {
        entityIds.push(...a.negativeEntities)
        entityIds.push(...a.requiredEntities)
        entityIds.push(...a.requiredEntitiesFromPayload)
        if (a.suggestedEntity) {
            entityIds.push(a.suggestedEntity)
        }
    })

    // Make unique
    entityIds = [...new Set(entityIds)]
    actionIds = [...new Set(actionIds)]

    // Make sure that each one exists
    const errors: string[] = []
    entityIds.forEach(eid => {
        if (!source.entities.find(e => e.entityId === eid)) {
            errors.push(`Entity ${eid} is not defined`)
        }
    })
    actionIds.forEach(aid => {
        if (!source.actions.find(a => a.actionId === aid)) {
            errors.push(`Action ${aid} is not defined`)
        }
    })
    return errors
}