/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as fs from 'fs'
import * as path from 'path'
import { Template, TemplateVariable, RenderedActionArgument } from '@conversationlearner/models'
import { CLDebug } from './CLDebug'
import { TemplateEngine, ActivityFactory } from 'botbuilder-lg'

/**
 * Provider for rendering LG templates.
 */
export class TemplateProvider {

    private static hasSubmitError = false

    public static LGTemplateDirectory(): string | null {
        const cwd = process.cwd()
        const lgDirectoryName = "lg"
        // TODO - make this configurable.
        let templateDirectory = path.join(cwd, `./${lgDirectoryName}`)
        if (fs.existsSync(templateDirectory)) {
            return templateDirectory
        }
        // Try up a directory or two as could be in /lib or /dist folder depending on deployment
        templateDirectory = path.join(cwd, `../${lgDirectoryName}`)
        if (fs.existsSync(templateDirectory)) {
            return templateDirectory
        }
        templateDirectory = path.join(cwd, `../../${lgDirectoryName}`)
        if (fs.existsSync(templateDirectory)) {
            return templateDirectory
        }
        return null
    }

    // TODO: Decouple template renderer from types from Action classes
    // E.g. use generic key,value object instead of RenderedActionArgument
    public static async RenderTemplate(templateName: string, templateArguments: RenderedActionArgument[], entityDisplayValues: Map<string, string>): Promise<any | null> {

        let entities = {}

        for (let templateArgument of templateArguments) {
            entities[templateArgument.parameter] = templateArgument.value
        }
        entityDisplayValues.forEach((value: string, key: string) => { entities[key] = value })

        const templateDirectory = this.LGTemplateDirectory()
        if (templateDirectory === null) {
            return null
        }
        const lgFilename = templateDirectory + "//" + templateName + ".lg"
        //Currently, we assume that each lg file only has one template    
        const engine = new TemplateEngine().addFile(lgFilename)
        const output = engine.evaluateTemplate(engine.templates[0].name, entities)
        return ActivityFactory.createActivity(output)
    }

    public static GetTemplates(): Template[] {
        const files = this.GetTemplatesNames()
        if (files.length === 0) {
            return []
        }
        const templateDirectory = this.LGTemplateDirectory()
        if (templateDirectory === null) {
            throw new Error("Could not find valid template directory")
        }
        const templates: Template[] = []
        for (const file of files) {
            const fileName = path.join(templateDirectory, `${file}.lg`)
            const engine = new TemplateEngine().addFile(fileName)
            let templateBody = ''
            if (file.includes('AdaptiveCard')) {
                templateBody = engine.templates[1].body
                templateBody = templateBody.replace("- ```\r\n", "").replace("```", "")
                for (let symbol of engine.templates[1].parameters) {
                    let sourceText = '@{' + symbol + '}'
                    let replaceText = '{{' + symbol + '}}'
                    templateBody = templateBody.replace(sourceText, replaceText)
                }
            }

            const validationError = this.hasSubmitError
                ? `Template "${file}" has an "Action.Submit" item but no data.  Submit item must be of the form: "type": "Action.Submit", "data": string` : null

            const tvs: TemplateVariable[] = []
            for (let par of engine.templates[0].parameters) {
                tvs.push({ key: par, type: 'lg' })
            }

            const template: Template = {
                name: file,
                variables: tvs,
                body: templateBody,
                validationError: validationError
            }
            templates.push(template)
        }

        return templates
    }

    public static GetTemplatesNames(): string[] {
        const templateDirectory = this.LGTemplateDirectory()
        if (templateDirectory === null) {
            return []
        }
        try {
            let fileNames: string[] = fs.readdirSync(templateDirectory)
            fileNames = fileNames.filter(fn => fn.endsWith('.lg'))
            return fileNames.map(f => f.slice(0, f.lastIndexOf('.')))
        } catch (e) {
            CLDebug.Log("No valid LG directory found")
            return []
        }
    }
}
