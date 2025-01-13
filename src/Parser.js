import React, { useState } from "react";
import anser from "anser";
import { format } from "date-fns";

import { ReactComponent as ArrowRight } from "./arrow-right.svg";
import { ReactComponent as ArrowDown } from "./arrow-down.svg";

// const startRegex = /section_start:(?<startTimestamp>\d+):(?<sectionName>.+)\re\[0K(?<sectionHeader>.+)?/;
const startRegex = /section_start:(?<startTimestamp>\d+):(?<sectionName>[a-zA-Z0-9-_]+)(?:\[(?<sectionOptions>[a-zA-Z0-9-_,=]+)\])?/;

// const endRegex = /section_end:(?<endTimestamp>\d+):(?<sectionName>.+)\re\[0K/;
const endRegex = /section_end:(?<endTimestamp>\d+):(?<sectionName>[a-zA-Z0-9-_]+)/;

function getStyle(part) {
  const style = {};

  if (part.decoration === "bold") {
    style.fontWeight = "bold";
  } else if (part.decoration === "dim") {
    style.opacity = 0.5;
  } else if (part.decoration === "italic") {
    style.fontStyle = "italic";
  } else if (part.decoration === "reverse") {
    style.filter = "invert(100%)";
  } else if (part.decoration === "hidden") {
    style.visibility = "hidden";
  } else if (part.decoration === "strikethrough") {
    style.textDecoration = "line-through";
  } else {
    style.textDecoration = part.decoration;
  }

  if (part.fg) {
    style.color = `rgb(${part.fg})`;
  }

  if (part.bg) {
    style.background = `rgb(${part.bg})`;
  }

  return style;
}

function convertDateToUTC(date) {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
}

function Parser(props) {
  const logsByRows = props.trace.split("\n").map((text, index) => {
    return {
      text,
      lineNumber: index + 1,
    };
  });

  const rootGroup =
  {
    lines: [],
    options: [],
    indent: 0,
  };

  let groupStack = [rootGroup];

  let lastGroup = rootGroup;

  for (const line of logsByRows) {
    const lastGroup = groupStack[groupStack.length - 1];
    const openMatched = line.text.match(startRegex);
    const closeMatched = line.text.match(endRegex);

    if (!openMatched && !closeMatched) {
      if(line.text)
      {
        lastGroup.lines.push(line);
      }
    } else if (openMatched) {
      const { startTimestamp, sectionName, sectionOptions } = openMatched.groups;

      const parsedOptions = sectionOptions ? sectionOptions.split(",") : [];

      let group = {
        lineNumber: line.lineNumber,
        startTimestamp,
        sectionName,
        lines: [],
        indent: lastGroup.indent + 1,
        options: parsedOptions,
      };
      lastGroup.lines.push(group);
      groupStack.push(group);
    } else if (closeMatched) {
      const { endTimestamp, sectionName } = closeMatched.groups;

      for(let groupIndex = groupStack.length - 1; groupIndex >= 1; --groupIndex)
      {
        const section = groupStack[groupIndex];
        // In case of missing end_section tags, apply to all still unclosed sections on the stack.
        section.endTimestamp = endTimestamp;
        if(section.sectionName === sectionName)
        {
          groupStack.splice(groupIndex, groupStack.length - groupIndex);
          break;
        }
      }
    }
  }

  window.__format = format;

  return (
    <Section {...rootGroup}/>
  );
}

function Section(props) {
  const [opened, toggle] = useState(props.options.includes("collapsed=true") ? false : true);

  let durationString;
  if (props.endTimestamp && props.startTimestamp) {
    const date = new Date((props.endTimestamp - props.startTimestamp) * 1000);
    const utcDate = convertDateToUTC(date);
    const template = utcDate.getHours() === 0 ? "mm:ss" : "HH:mm:ss";
    durationString = format(convertDateToUTC(date), template);
  }

  return (
    <>
      <section>
        {props.lines.map((line, lineIndex) => {

          const sectionStart = lineIndex === 0 && props.sectionName;

          if (sectionStart || opened) {
            if('text' in line)
            {
              const formatedText = anser.ansiToJson(line.text).map((stringPart, partIndex) => {
                return stringPart.content ? (
                  <span key={partIndex} style={getStyle(stringPart)}>
                    {stringPart.content}
                  </span>
                ) : null;
              }).filter(Boolean);

              if(sectionStart || formatedText.length > 0)
              {
                return (
                  <div
                    key={lineIndex}
                    className={`row ${sectionStart ? "section-row" : ""}`}
                    onClick={sectionStart ? () => toggle(!opened) : undefined}
                    role={sectionStart ? "button" : ""}
                    id={`L${line.lineNumber}`}
                  >
                    {sectionStart && (
                      <div className="arrow">
                        {opened ? <ArrowDown /> : <ArrowRight />}
                      </div>
                    )}
                    <a
                      href={`#L${line.lineNumber}`}
                      className="line-number"
                    >
                      {line.lineNumber}
                    </a>

                    <div className="text" style={{'padding-left': (sectionStart ? props.indent - 1 : props.indent) * 2 + "ex"}}>
                      <div>
                        {formatedText}
                      </div>
                      {sectionStart && (
                        <span className="duration">{durationString}</span>
                      )}
                    </div>
                  </div>
                );
              }
            }
            else if('lines' in line)
            {
              return (<Section {...line} key={lineIndex}/>);
            }
          }
          return null;
        })}
      </section>
    </>
  );
}

export default Parser;
