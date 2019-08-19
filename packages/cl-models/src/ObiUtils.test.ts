/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { LGItem, ObiUtils } from "./ObiUtils"

interface TestData {
    tag: string
    text: string
    suggestions: string[]
}

const testDataToMap = (data : TestData[]) => {
    let output = new Map<string, LGItem>()
    for (const datum of data) {
        let d = {
            text: datum.text,
            suggestions: datum.suggestions
        }
        output.set(datum.tag, d)
    }
    return output
}

describe('OBIutils', () => {
    describe('ObiUtils', () => {
        test('Given a well-formed input, verifies the expected output', () => {
            let input = `
            # option0
            - \`\`\`
            Hi! I'm a virtual agent. I can help with account questions, orders, store information, and more.
            [Suggestions=]
            \`\`\`
            # option1
            - \`\`\`
            If you'd like to speak to a human agent, let me know at any time.
            [Suggestions=Talk to agent|Goodbye]
            \`\`\`
            `
            const lgMap = new Map<string, LGItem>()
            ObiUtils.addToLGMap(input, lgMap)
            let expected: Map<string, LGItem> = testDataToMap([
                {
                    tag: 'option0',
                    text: `Hi! I'm a virtual agent. I can help with account questions, orders, store information, and more.`,
                    suggestions: []
                },
                {
                    tag: 'option1',
                    text: `If you'd like to speak to a human agent, let me know at any time.`,
                    suggestions: ['Talk to agent', 'Goodbye']

                }
            ])
            expect(lgMap).toMatchObject(expected)
        })
        test('Validate exception on missing expected tokens', () => {
            let inputs = [
                {
                    missing_str: '-',
                    input: `
                # option0
                \`\`\`
                This config is missing a hyphen
                [Suggestions=]
                \`\`\`
                `},
                {
                    // Not '```' since the input contains it later.
                    missing_str: '```',
                    input: `
                # option0
                -
                This config is missing the leading 3 backticks
                [Suggestions=]
                \`\`\`
                `},
                {
                    missing_str: '[',
                    input: `
                # option0
                - \`\`\`
                This config is missing an open bracket
                Suggestions=]
                \`\`\`
                `},
                {
                    missing_str: ']',
                    input: `
                # option0
                - \`\`\`
                This config is missing a close bracket
                [Suggestions=
                \`\`\`
                `},
                // Don't test for trailing backticks, these are not currently required.
            ]
            for (const data of inputs) {
                try {
                    ObiUtils.addToLGMap(data.input, new Map<string, LGItem>())
                    fail('Did not get expected exception')
                } catch (e) {
                    if (e instanceof RangeError) {
                        expect(e.message).toBe(`${data.missing_str} not found`)
                    } else {
                        fail('Unexpected error')
                    }
                }
            }

        })
    })
})
