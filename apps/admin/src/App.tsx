import React from "react";
import { RouterProvider } from "react-router-dom";
import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api";
import { AuthProvider } from "./context/AuthContext";
import { router } from "./router";
import "dayjs/locale/vi";

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfigProvider
          locale={viVN}
          theme={{
            token: {
              colorPrimary: "#c05c74",
              colorLink: "#c05c74",
              colorLinkHover: "#a8455c",
              borderRadius: 6,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            },
            components: {
              Button: {
                controlHeight: 36,
              },
              Table: {
                headerBg: "#fafafa",
              },
            },
          }}
        >
          <RouterProvider router={router} />
        </ConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
