import React from 'react';
import {useTransition, animated} from 'react-spring';

export default function LogView({items}) {
  const transition = useTransition(items, {
    keys: (item) => item.id,
    from: {opacity: 0},
    enter: {opacity: 1},
    leave: {opacity: 0},
  });

  return transition((style, item) => {
    return (
      <animated.div style={style}>
        <div style={{lineHeight: '1.2em'}}>{item.msg}</div>
      </animated.div>
    );
  });
}
