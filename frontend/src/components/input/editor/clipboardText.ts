import type {Fragment, Node, Slice} from '@tiptap/pm/model'

// Plain text for the clipboard that keeps the structure a reader needs, most
// importantly list markers, which the default text serializer throws away.

function leafText(node: Node): string {
	if (node.type.name === 'hardBreak') {
		return '\n'
	}
	const fromSpec = node.type.spec.leafText?.(node)
	return fromSpec ?? node.textContent
}

function inlineText(fragment: Fragment): string {
	let text = ''
	fragment.forEach(child => {
		if (child.isText) {
			text += child.text ?? ''
		} else if (child.isLeaf) {
			text += leafText(child)
		} else {
			text += inlineText(child.content)
		}
	})
	return text
}

type Marker = (index: number, item: Node) => string

function serializeList(list: Node, indent: string, marker: Marker): string {
	const items: string[] = []
	list.forEach((item, _offset, index) => {
		const prefix = marker(index, item)
		const childIndent = indent + ' '.repeat(prefix.length)
		const parts: string[] = []
		item.forEach((child, _childOffset, childIndex) => {
			const text = serializeBlock(child, childIndent)
			parts.push(childIndex === 0
				? indent + prefix + text.slice(childIndent.length)
				: text)
		})
		if (parts.length === 0) {
			parts.push(indent + prefix)
		}
		items.push(parts.join('\n'))
	})
	return items.join('\n')
}

function serializeChildren(fragment: Fragment, indent: string, separator: string): string {
	if (fragment.firstChild?.isInline) {
		return indent + inlineText(fragment).replace(/\n/g, '\n' + indent)
	}
	const parts: string[] = []
	fragment.forEach(child => parts.push(serializeBlock(child, indent)))
	return parts.join(separator)
}

function serializeBlock(node: Node, indent: string): string {
	switch (node.type.name) {
		case 'bulletList':
			return serializeList(node, indent, () => '- ')
		case 'orderedList': {
			const start = Number(node.attrs.start ?? 1)
			return serializeList(node, indent, index => `${start + index}. `)
		}
		case 'taskList':
			return serializeList(node, indent, (_index, item) => item.attrs.checked ? '- [x] ' : '- [ ] ')
		case 'table':
			return serializeChildren(node.content, indent, '\n')
		case 'tableRow': {
			const cells: string[] = []
			node.forEach(cell => cells.push(serializeChildren(cell.content, '', ' ')))
			return indent + cells.join('\t')
		}
	}

	if (node.isTextblock) {
		return indent + inlineText(node.content).replace(/\n/g, '\n' + indent)
	}

	if (node.isLeaf) {
		return indent + leafText(node)
	}

	return serializeChildren(node.content, indent, '\n\n')
}

export function serializeClipboardText(slice: Slice): string {
	return serializeChildren(slice.content, '', '\n\n')
}
