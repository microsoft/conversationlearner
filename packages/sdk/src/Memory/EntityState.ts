/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { CLStorage } from './CLStorage'
import { CLDebug } from '../CLDebug'
import { Memory, FilledEntity, MemoryValue, FilledEntityMap } from '@conversationlearner/models'
import { ClientMemoryManager } from '..'

const NEGATIVE_PREFIX = '~'

export type GetKey = () => string

/**
 * Memory for a given entity
 */
export class EntityState {
    private storage: CLStorage
    private getKey: GetKey
    public filledEntityMap = new FilledEntityMap()

    constructor(storage: CLStorage, getKey: GetKey) {
        this.storage = storage
        this.getKey = getKey
    }

    public async FilledEntityMap(): Promise<FilledEntityMap> {
        await this.Init()
        return this.filledEntityMap
    }

    private async Init(): Promise<void> {
        const key = this.getKey()
        let data = await this.storage.GetAsync(key)
        if (data) {
            this.Deserialize(data)
        } else {
            this.ClearAsync()
        }
    }

    private Serialize(): string {
        return JSON.stringify(this.filledEntityMap.map)
    }

    private Deserialize(text: string): void {
        if (!text) {
            return
        }
        let json = JSON.parse(text)
        this.filledEntityMap.map = json ? json : {}
    }

    private async Set(): Promise<void> {
        const key = this.getKey()
        await this.storage.SetAsync(key, this.Serialize())
    }

    public async RestoreFromMapAsync(filledEntityMap: FilledEntityMap): Promise<void> {
        this.filledEntityMap.map = filledEntityMap.map
        await this.Set()
    }

    public async RestoreFromMemoryManagerAsync(memoryManager: ClientMemoryManager): Promise<void> {
        // Disable memory manager.  Use has been completed
        memoryManager.Expire()
        this.filledEntityMap.map = memoryManager.curMemories.map
        await this.Set()
    }

    // Clear memory values not in saveList
    public async ClearAsync(saveList?: string[] | void): Promise<void> {
        if (!saveList) {
            this.filledEntityMap = new FilledEntityMap()
        }
        else {
            for (let key of Object.keys(this.filledEntityMap.map)) {
                if (saveList.indexOf(key) < 0) {
                    delete this.filledEntityMap.map[key]
                }
            }

        }
        await this.Set()
    }

    // Remember value for an entity
    public async RememberEntity(entityName: string, entityId: string, entityValue: string, isBucket: boolean = false, builtinType: string | null = null, resolution: {} | null = null): Promise<void> {
        await this.Init()
        this.filledEntityMap.Remember(entityName, entityId, entityValue, isBucket, builtinType, resolution)
        await this.Set()
    }

    // Remember multiple values for an entity
    public async RememberMany(entityName: string, entityId: string, entityValues: string[], isBucket: boolean = false, builtinType: string | null = null, resolution: {} | null = null): Promise<void> {
        await this.Init()
        this.filledEntityMap.RememberMany(entityName, entityId, entityValues, isBucket, builtinType, resolution)
        await this.Set()
    }

    /** Return array of entity names for which I've remembered something */
    public async RememberedNames(): Promise<string[]> {
        await this.Init()
        return Object.keys(this.filledEntityMap)
    }

    /** Return array of entity Ids for which I've remembered something */
    public async FilledEntitiesAsync(): Promise<FilledEntity[]> {
        await this.Init()
        return this.filledEntityMap.FilledEntities()
    }

    /** Given negative entity name, return positive version */
    private PositiveName(negativeName: string): string | null {
        if (negativeName.startsWith(NEGATIVE_PREFIX)) {
            return negativeName.slice(1)
        }
        return null
    }

    /** Forget a predicted Entity */
    public async ForgetEntity(entityName: string, entityValue: string, isMultiValue: boolean): Promise<void> {
        let posName = this.PositiveName(entityName)
        if (posName) {
            await this.Forget(posName, entityValue, isMultiValue)
        }
    }

    /** Forget an entity value */
    public async Forget(entityName: string, entityValue: string | null = null, isBucket: boolean = false): Promise<void> {
        try {
            // Check if entity buckets values
            await this.Init()
            this.filledEntityMap.Forget(entityName, entityValue, isBucket)
            await this.Set()
        } catch (error) {
            CLDebug.Error(error)
        }
    }

    public async DumpMemory(): Promise<Memory[]> {
        await this.Init()
        return this.filledEntityMap.ToMemory()
    }

    public async Value(entityName: string): Promise<string | null> {
        await this.Init()
        return this.filledEntityMap.ValueAsString(entityName)
    }

    public async ValueAsList(entityName: string): Promise<string[]> {
        await this.Init()
        return this.filledEntityMap.ValueAsList(entityName)
    }

    public async ValueAsPrebuilt(entityName: string): Promise<MemoryValue[]> {
        await this.Init()
        return this.MemoryValues(entityName)
    }

    private MemoryValues(entityName: string): MemoryValue[] {
        if (!this.filledEntityMap.map[entityName]) {
            return []
        }

        return this.filledEntityMap.map[entityName].values
    }
}
