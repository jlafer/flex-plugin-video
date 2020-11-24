export default {
  baseName: "FlexLight",
  colors: {
      lightTextColor: "#ffffff",
      darkTextColor: "#035450",
      focusColor: "#035450",
      focusGlow: "#035450",
  },
  overrides: {
      MainHeader: {
          Container: {
              color: "#035450",
              borderBottomWidth: "20",
              borderImage: "linear-gradient(to right, #009792, #23b9d6 50%, #c6d86b)",
              borderImageSource: "linear-gradient(to right, #009792, #23b9d6 50%, #c6d86b)",
              borderImageSlice: 1
             
          },
          Button: {
              background: "#ffffff",
              color: "#035450"
          }
      },
      SideNav: {
          Container: {
              background: "#2aa4a2",
          },
          Button: {
              background: "#2aa4a2",
              color: "#ffffff"
          },
          Icon: {
              color: "#ffffff"
          }
      },

      TaskCanvasHeader: {
          // WrapupTaskButton: {
          //     background: colors.declineColor,
          //     color: colors.declineTextColor,
          // },
          EndTaskButton: {
              background: "#2aa4a2",
              color: "#ffffff",
          }
      },
      TaskList: {
          Item: {
              Icon: {
                  color: "#035450",
              },
          },
      }
  }
  
}
