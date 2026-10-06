// A view that throws over what it is shown: `graview view check` says so.
graview.onProps((props) => {
  throw new Error(`no package drawn: ${props.nodes.length} records were shown`);
});
