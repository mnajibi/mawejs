//*****************************************************************************
//*****************************************************************************
//
// File editor
//
//*****************************************************************************
//*****************************************************************************

import "./styles/editor.css"
import "../common/styles/sheet.css"

/* eslint-disable no-unused-vars */

import React, {
  useState, useEffect, useReducer,
  useMemo, useCallback,
  useDeferredValue,
  StrictMode,
} from 'react';

import {
  Slate, useSlate, ReactEditor,
} from "slate-react"

import {
  Editor, Node, Transforms, Range, Point,
} from "slate";

import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

import {
  getEditor, SlateEditable,
  section2edit, updateSection,
  hasElem,
  focusByPath, focusByID,
  elemPop, elemPushTo,
  searchFirst, searchForward, searchBackward,
  isAstChange,
} from "./slateEditor"

import {
  SlateTOC,
} from "./slateIndex"

import {
  FlexBox, VBox, HBox, Filler, VFiller, HFiller,
  ToolBox, Button, Icon, Tooltip,
  ToggleButton, ToggleButtonGroup, MakeToggleGroup,
  Input,
  SearchBox, addHotkeys,
  Label,
  List, ListItem, ListItemText,
  Grid,
  Separator, Loading, addClass,
  Menu, MenuItem,
  isHotkey,
  DataGrid,
} from "../common/factory";

import {
  SectionWordInfo,
  ChooseVisibleElements, ChooseWordFormat,
} from "../common/components";

import { styled } from '@mui/material/styles';
import {sleep} from "../../util";
import {section2words, wordTable} from "../../document/util";

//import { mawe } from "../../document";

//-----------------------------------------------------------------------------

export function SingleEditView({doc, setDoc, focusTo, setFocusTo}) {

  //---------------------------------------------------------------------------
  // For development purposes:
  //---------------------------------------------------------------------------

  /*
  return <React.Fragment>
    <HBox>
    <Pre style={{ width: "50%" }} content={doc.story} />
    <Pre style={{ width: "50%" }} content={mawe.fromXML(mawe.buf2tree(mawe.tree2buf(mawe.toXML(slate2doc(doc, doc2slate(doc)).story))))} />
    </HBox>
  </React.Fragment>
  /**/

  /*
  return <Pre content={doc.story.notes} />
  /**/

  //---------------------------------------------------------------------------
  // slate buffers
  //---------------------------------------------------------------------------

  //console.log("Story ID:", doc.story.uuid)

  const bodyeditor = useMemo(() => getEditor(), [])
  const noteeditor = useMemo(() => getEditor(), [])

  const [bodybuffer, _setBodyBuffer] = useState(() => section2edit(doc.story.body))
  const [notebuffer, _setNoteBuffer] = useState(() => section2edit(doc.story.notes))

  //console.log(doc.story.body)
  //console.log(bodybuffer)

  //---------------------------------------------------------------------------
  // Get updates from Slate, and apply them to doc, too
  //---------------------------------------------------------------------------

  const updateBody = useCallback(buffer => {
    if(isAstChange(bodyeditor)) setDoc(doc => {
      const updated = updateSection(buffer, doc.story.body)
      //console.log(updated)
      return {
        ...doc,
        story: {
          ...doc.story,
          body: updated,
        }
      }
    })
  }, [bodyeditor])

  const updateNotes = useCallback(buffer => {
    if(isAstChange(noteeditor)) setDoc(doc => {
      const updated = updateSection(buffer, doc.story.notes)
      //console.log(updated)
      return {
        ...doc,
        story: {
          ...doc.story,
          notes: updated,
        }
      }
    })
  }, [noteeditor])

  //---------------------------------------------------------------------------
  // Section selection
  //---------------------------------------------------------------------------

  const [active, _setActive] = useState(focusTo?.sectID ?? "body")

  //console.log("ActiveID:", active)

  const setActive = useCallback((sectID, elemID) => {
    //console.log("setActive:", sectID, elemID)
    _setActive(sectID)
    setFocusTo({id: elemID})
  })

  const activeEdit = useCallback(() => {
    switch(active) {
      case "body": return bodyeditor
      case "notes": return noteeditor
    }
  }, [active])

  useEffect(() => {
    const editor = activeEdit()
    const id = focusTo?.id
    console.log("Focus to:", id)
    if(editor) focusByID(editor, id)
  }, [active, focusTo])

  //---------------------------------------------------------------------------
  // Search
  //---------------------------------------------------------------------------

  const [searchText, _setSearchText] = useState()
  const highlightText = useDeferredValue(searchText)

  const setSearchText = useCallback(text => {
    _setSearchText(text)
    searchFirst(activeEdit(), text)
  }, [activeEdit])

  //---------------------------------------------------------------------------
  // Index settings: Change these to component props
  //---------------------------------------------------------------------------

  const [indexed1, setIndexed1] = useState(["part", "scene", "synopsis"])
  const [words1, setWords1] = useState("numbers")

  const bodyindex_settings = {
    indexed: {
      choices:  ["scene", "synopsis", "missing", "comment"],
      value:    indexed1,
      setValue: setIndexed1,
    },
    words: {
      choices:  ["off", "numbers", "percent", "cumulative"],
      value:    words1,
      setValue: setWords1,
    },
  }

  const [indexed2, setIndexed2] = useState(["part", "scene", "synopsis"])

  const noteindex_settings = {
    indexed: {
      value: indexed2,
    }
  }

  //---------------------------------------------------------------------------
  // Hotkeys
  //---------------------------------------------------------------------------

  useEffect(() => addHotkeys({
    "mod+f": ev => {
      const editor = activeEdit()
      const focused = ReactEditor.isFocused(editor)
      if(focused) {
        const {selection} = editor
        if(selection) {
          const text = Editor.string(editor, selection)
          if(text) {
            Transforms.select(editor, Range.start(selection))
            _setSearchText(text)
            return;
          }
        }
      }
      if(typeof(searchText) !== "string") _setSearchText("")
    },
    "escape": ev => {
      if(typeof(searchText) === "string") {
        _setSearchText(undefined)
        ReactEditor.focus(activeEdit())
      }
    },
    "mod+g": ev => searchForward(activeEdit(), searchText, true),
    "shift+mod+g": ev => searchBackward(activeEdit(), searchText, true)
  }));

  //---------------------------------------------------------------------------
  // Debug/development view

  /*
  return <>
    <EditToolbar {...{bodyindex_settings, noteindex_settings, bodyFromEdit, searchText, setSearchText}}/>
    <HBox style={{overflow: "auto"}}>
      <Slate editor={bodyeditor} value={bodybuffer} onChange={updateBody}>
        <EditorBox mode="Condensed" visible={active === "body"} search={searchText}/>
        <SlateAST />
      </Slate>
    </HBox>
    </>
  /**/

  //---------------------------------------------------------------------------
  // Render elements: what we want is to get menu items from subcomponents to
  // the toolbar.

  //const [rightpanel, setRightpanel] = useState("noteindex")
  const [selectRight, setSelectRight] = useState("wordtable")

  const left  = LeftPanel({style: {maxWidth: "400px", width: "400px"}})
  const right = RightPanel({style: {maxWidth: "300px", width: "300px"}})

  //---------------------------------------------------------------------------

  return <>
    <EditToolbar
      //editor={activeEdit()}
      editor={bodyeditor}
      left={left.menu}
      right={right.menu}
      searchText={searchText}
      setSearchText={setSearchText}
      rightpanel={selectRight}
      setRightpanel={setSelectRight}
      section={doc.story.body}
      {...{noteindex_settings}}
      />
    <HBox style={{overflow: "auto"}}>
      <DragDropContext onDragEnd={onDragEnd}>
      {left.panel}
      <EditorBox
        editor={bodyeditor}
        value={bodybuffer}
        onChange={updateBody}
        mode="Regular"
        visible={active === "body"}
        highlight={highlightText}
        />
      <EditorBox
        editor={noteeditor}
        value={notebuffer}
        onChange={updateNotes}
        mode="Regular"
        visible={active === "notes"}
        highlight={highlightText}
        />
      {right.panel}
      </DragDropContext>
    </HBox>
    </>

  //---------------------------------------------------------------------------
  // Side panels
  //---------------------------------------------------------------------------

  function LeftPanel({style}) {
    const {width, minWidth, maxWidth} = style

    const menu  = <HBox style={{height: "28px", width, minWidth, maxWidth}}>
      <ChooseVisibleElements elements={bodyindex_settings.indexed}/>
      <Separator/>
      <ChooseWordFormat format={bodyindex_settings.words}/>
    </HBox>

    const panel = <SlateTOC
      style={style}
      section={doc.story.body}
      include={indexed1}
      wcFormat={words1}
      activeID="body"
      setActive={setActive}
    />

    return {menu, panel}
  }

  function RightPanel({style}) {
    const {width, minWidth, maxWidth} = style

    switch(selectRight) {
      case "noteindex": return NoteIndex()
      case "wordtable": return WordTable()
    }

    function NoteIndex() {

      const menu = <HBox style={{height: "28px", width, minWidth, maxWidth}}>
        <ChooseRightPanel selected={selectRight} setSelected={setSelectRight}/>
      </HBox>

      const panel = <SlateTOC
        style={style}
        section={doc.story.notes}
        include={indexed2}
        activeID="notes"
        setActive={setActive}
      />

      return {menu, panel}
    }

    function WordTable() {
      const wt = Array.from(wordTable(doc.story.body).entries()).map(([word, count]) => ({id: word, count}))
      //console.log(wt)

      const menu = <HBox style={{height: "28px", width, minWidth, maxWidth}}>
        <ChooseRightPanel selected={selectRight} setSelected={setSelectRight}/>
      </HBox>

      // Use this to test performance of table generation
      /*
      return <VBox style={style}>
        Testing, testing...
      </VBox>
      /*/
      const panel = <VBox style={style}>
        <DataGrid
        //style={style}
        onRowClick={params => setSearchText(params.row.id)}
        //throttleRowsMs={500}
        //width="100%"
        density="compact"
        columns={[
          {
            field: "id",
            headerName: "Word",
          },
          {
            field: "count",
            headerName: "Count",
            align: "right", headerAlign: "right",
          }
        ]}
        rows={wt}
      />
      </VBox>
      /**/
      return {menu, panel}
    }
  }

  //---------------------------------------------------------------------------
  // Index DnD
  //---------------------------------------------------------------------------

  function onDragEnd(result) {

    //console.log("onDragEnd:", result)

    const {type, draggableId, source, destination} = result;

    if(!destination) return;

    if(source.droppableId === destination.droppableId) {
      if(source.index === destination.index) return;
    }

    //console.log(type, source, "-->", destination)

    function getSectIDByElemID(elemID) {
      if(!elemID) return undefined
      if(hasElem(bodyeditor, elemID)) return "body"
      if(hasElem(noteeditor, elemID)) return "notes"
      return undefined
    }

    function getEditor(sectID) {
      switch(sectID) {
        case "body": return bodyeditor;
        case "notes": return noteeditor;
      }
    }

    function moveElem(srcEdit, srcId, dstEditID, dstEdit, dstId, dstIndex) {
      elemPushTo(dstEdit,
        elemPop(srcEdit, srcId),
        dstId,
        dstIndex
      )

      setActive(dstEditID, draggableId)
    }

    switch(type) {
      case "scene": {
        const srcEditID = getSectIDByElemID(source.droppableId)
        const dstEditID = getSectIDByElemID(destination.droppableId)
        const srcEdit = getEditor(srcEditID)
        const dstEdit = getEditor(dstEditID)

        moveElem(srcEdit, draggableId, dstEditID, dstEdit, destination.droppableId, destination.index)
        break;
      }

      case "part": {
        const srcEditID = source.droppableId
        const dstEditID = destination.droppableId
        const srcEdit = getEditor(srcEditID)
        const dstEdit = getEditor(dstEditID)

        moveElem(srcEdit, draggableId, dstEditID, dstEdit, null, destination.index)
        break;
      }
      default:
        console.log("Unknown draggable type:", type, result)
        return;
    }
  }
}

//-----------------------------------------------------------------------------
// Toolbar
//-----------------------------------------------------------------------------

function EditToolbar({editor, section, left, right, searchText, setSearchText}) {

  return <ToolBox style={{ background: "white" }}>
    {left}
    <Separator/>
    <Searching editor={editor} searchText={searchText} setSearchText={setSearchText}/>
    <Filler/>
    <Separator/>
    <SectionWordInfo sectWithWords={section}/>
    <Separator/>
    {right}
  </ToolBox>
}

  /*
  function EditToolbar() {
  const editor = useSlate()

  // Block type under cursor
  const [match] = Editor.nodes(editor, { match: n => Editor.isBlock(editor, n)})
  const nodetype = match ? match[0].type : undefined

  return <ToolBox style={{ background: "white" }}>
    <Button>Block: {nodetype}</Button>
    <Filler/>
  </ToolBox>
  }
*/

class Searching extends React.PureComponent {

  render() {
    const {editor, searchText, setSearchText} = this.props

    if(typeof(searchText) !== "string") return <Button>
      <Icon.Action.Search onClick={ev => setSearchText("")}/>
    </Button>

    return <SearchBox
      key={searchText}
      size="small"
      value={searchText}
      autoFocus
      onChange={ev => setSearchText(ev.target.value)}
      onKeyDown={ev => {
        if(isHotkey("enter", ev)) {
          ev.preventDefault();
          ev.stopPropagation();
          if(searchText === "") setSearchText(undefined)
          searchFirst(editor, searchText, true)
        }
      }}
    />
  }
}

class ChooseRightPanel extends React.PureComponent {

  buttons = {
    "noteindex": {
      tooltip: "Notes Index",
      icon: <Icon.Placeholder />
    },
    "wordtable": {
      tooltip: "Word frequeny",
      icon: <Icon.Placeholder />
    },
  }

  render() {
    const {selected, setSelected} = this.props

    const choose = {
      choices: ["noteindex", "wordtable"],
      value: selected,
      setValue: setSelected
    }

    return MakeToggleGroup(this.buttons, choose, true);
  }
}

//-----------------------------------------------------------------------------

function EditorBox({style, editor, value, onChange, mode="Condensed", visible=true, highlight=undefined}) {
  return <Slate editor={editor} value={value} onChange={onChange}>
    {visible
    ? <div className="Filler Board" style={{...style}}>
        <SlateEditable className={mode} highlight={highlight}/>
      </div>
    : null}
    </Slate>
}

//-----------------------------------------------------------------------------

/*
function IndexBox({settings, section, style}) {
  const props = {settings, section, style}

  return <SlateTOC {...props}/>
}
*/

//-----------------------------------------------------------------------------

function SlateAST({}) {
  const editor = useSlate()

  return <Pre style={{ width: "50%" }} content={editor.children} />
}

function Pre({ style, content }) {
  return <pre style={{ fontSize: "10pt", ...style }}>
    {typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}`}
  </pre>
}

function Empty() {
  return null;
}
